"""ONE-TIME conversion of YOUR trained notebook outputs to ONNX for the Node server (not part of the website).
Run in Kaggle/Colab/your PC after training:  pip install torch onnx onnxruntime scikit-learn (+ tensorflow for CNN)
  python export_models.py --dnn DIR --cldnn DIR --cnn DIR --classical DIR --out ../models [--limit N]
DIR = the notebook's output folder (dnn_original_updates_v5, cldnn_..., cnn_..., classical_accuracy_v6). Pass any subset.
Every exported member is checked against the original model (script stops if outputs differ)."""
import argparse, glob, json, os
import numpy as np, torch, torch.nn as nn, onnxruntime as ort

# ---- architectures: copied from your DNN / CLDNN notebooks ----
class ResidualMLPBlock(nn.Module):
    def __init__(self,d,drop):
        super().__init__();self.net=nn.Sequential(nn.Linear(d,d),nn.LayerNorm(d),nn.GELU(),nn.Dropout(drop),nn.Linear(d,d))
    def forward(self,x):return torch.nn.functional.gelu(x+self.net(x))
class DNN(nn.Module):
    def __init__(self,d,cfg):
        super().__init__();w=cfg['width'];drop=cfg['drop']
        self.net=nn.Sequential(nn.Linear(d,w),nn.LayerNorm(w),nn.GELU(),ResidualMLPBlock(w,drop),
            nn.Dropout(drop),nn.Linear(w,64),nn.GELU(),nn.Dropout(drop),nn.Linear(64,2))
    def forward(self,x):return self.net(x)
class ResidualTemporalBlock(nn.Module):
    def __init__(self,i,o,k):
        super().__init__()
        self.path=nn.Sequential(nn.Conv1d(i,o,k,padding=k//2),nn.GroupNorm(8,o),nn.GELU(),nn.Conv1d(o,o,3,padding=1),nn.GroupNorm(8,o))
        self.skip=nn.Conv1d(i,o,1) if i!=o else nn.Identity()
        self.pool=nn.AvgPool1d(2)
    def forward(self,x):return self.pool(torch.nn.functional.gelu(self.path(x)+self.skip(x)))
class CLDNN(nn.Module):
    def __init__(self,n_ch,cfg):
        super().__init__();w=cfg['width'];drop=cfg['drop']
        self.cnn=nn.Sequential(ResidualTemporalBlock(n_ch,w,15),ResidualTemporalBlock(w,w*2,7),ResidualTemporalBlock(w*2,w*2,3),nn.Dropout(drop))
        self.lstm=nn.LSTM(w*2,64,batch_first=True,bidirectional=True)
        self.att=nn.Sequential(nn.Linear(128,64),nn.Tanh(),nn.Linear(64,1))
        self.head=nn.Sequential(nn.Linear(128,64),nn.GELU(),nn.Dropout(drop),nn.Linear(64,2))
    def forward(self,x):
        x=self.cnn(x).transpose(1,2);x,_=self.lstm(x)
        return self.head((self.att(x).softmax(1)*x).sum(1))

# ---- wrappers: the website feeds raw (un-normalised) features / time-major epochs; scaling lives inside the model ----
class DNNW(nn.Module):
    def __init__(s,m,mu,sd): super().__init__();s.m=m;s.register_buffer('mu',mu.float());s.register_buffer('sd',sd.float())
    def forward(s,x): return s.m((x-s.mu)/s.sd).softmax(1)                       # x: (N,152)
class CLW(nn.Module):
    def __init__(s,m): super().__init__();s.m=m
    def forward(s,x): return s.m(x.transpose(1,2)).softmax(1)                    # x: (N,1024,19)
class SVMW(nn.Module):  # RBF SVC re-expressed in torch: decision = sum(dual_coef*K(sv,x)) + b  (sign: >0 -> class 1 = AD)
    def __init__(s,sc,svm):
        super().__init__();s.register_buffer('mu',torch.tensor(sc.mean_,dtype=torch.float32));s.register_buffer('sd',torch.tensor(sc.scale_,dtype=torch.float32))
        s.register_buffer('sv',torch.tensor(svm.support_vectors_,dtype=torch.float32));s.register_buffer('coef',torch.tensor(svm.dual_coef_[0],dtype=torch.float32))
        s.b=float(svm.intercept_[0]);s.gamma=float(svm._gamma)
    def forward(s,x):                                                            # x: (N,247)
        z=(x-s.mu)/s.sd;d2=(z*z).sum(1,keepdim=True)+(s.sv**2).sum(1)-2*z@s.sv.T
        return (torch.exp(-s.gamma*d2)@s.coef+s.b).unsqueeze(1)
class Flat(nn.Module):
    def forward(s,x): return x.permute(0,2,3,1).flatten(1)                       # Keras flattens channels-last
class CNNW(nn.Module):  # Keras CNN (Conv2D/BN/ReLU/MaxPool/Dense) rebuilt in torch from the saved weights
    def __init__(s,km):
        super().__init__();L=[];t=torch.tensor
        for l in km.layers:
            n=type(l).__name__;w=l.get_weights()
            if n=='Conv2D':
                c=nn.Conv2d(w[0].shape[2],w[0].shape[3],3,padding=1);c.weight.data=t(w[0].transpose(3,2,0,1)).contiguous();c.bias.data=t(w[1]);L.append(c)
            elif n=='BatchNormalization':
                b=nn.BatchNorm2d(len(w[0]),eps=float(l.epsilon));b.weight.data,b.bias.data,b.running_mean,b.running_var=t(w[0]),t(w[1]),t(w[2]),t(w[3]);L.append(b)
            elif n=='MaxPooling2D':L.append(nn.MaxPool2d(2))
            elif n=='Flatten':L.append(Flat())
            elif n=='Dense':
                d=nn.Linear(w[0].shape[0],w[0].shape[1]);d.weight.data=t(w[0].T).contiguous();d.bias.data=t(w[1]);L.append(d)
                a=l.activation.__name__;L.append(nn.Softmax(1) if a=='softmax' else nn.ReLU() if a=='relu' else nn.Identity())
            elif n=='Activation' and l.activation.__name__=='relu':L.append(nn.ReLU())
        s.net=nn.Sequential(*L)
    def forward(s,x): return s.net(x.unsqueeze(1))                               # x: (N,128,19)

def export(m,example,path,tol,ref=None):
    m.eval()
    kw=dict(input_names=['x'],output_names=['y'],dynamic_axes={'x':{0:'n'},'y':{0:'n'}},opset_version=17)
    try: torch.onnx.export(m,example,path,dynamo=False,**kw)
    except TypeError: torch.onnx.export(m,example,path,**kw)
    got=ort.InferenceSession(path,providers=['CPUExecutionProvider']).run(None,{'x':example.numpy()})[0]
    with torch.no_grad(): want=m(example).numpy()
    if ref is not None: want_ref=ref(example.numpy()); assert np.abs(want-want_ref).max()<tol,f'{path}: rebuilt model differs from original by {np.abs(want-want_ref).max()}'
    err=float(np.abs(got-want).max()); assert err<tol,f'{path}: ONNX differs from PyTorch by {err}'
    print('ok',os.path.basename(path),f'(max diff {err:.1e})')

def meta(out,fid,**kw):
    d=os.path.join(out,fid);os.makedirs(d,exist_ok=True)
    acc,correct=kw.pop('acc');json.dump(dict(accuracy=acc,correct=correct,n_test=232,**kw),open(f'{d}/meta.json','w'),indent=1)
    json.dump(dict(accuracy=acc,correct=correct,n_test=232),open(f'{d}/metrics.json','w'));return d

ap=argparse.ArgumentParser();[ap.add_argument('--'+k) for k in('dnn','cldnn','cnn','classical')]
ap.add_argument('--out',default='../models');ap.add_argument('--limit',type=int,default=0);a=ap.parse_args();rnd=torch.randn
files=lambda d,pat:sorted(glob.glob(os.path.join(d,pat)))[:a.limit or None]
if a.dnn:
    d=meta(a.out,'dnn',name='DNN (spectral features)',description='Residual MLP on 152 spectral features per 8 s epoch',input='feat152',pooling='prob',acc=(.9440,219))
    for p in files(a.dnn,'DNN_outerseed*_fold*_init*.pt'):
        ck=torch.load(p,map_location='cpu',weights_only=False);m=DNN(ck['input_dimension'],ck['config']);m.load_state_dict(ck['state_dict'])
        export(DNNW(m,torch.as_tensor(ck['mu']),torch.as_tensor(ck['sd'])),rnd(8,152),f'{d}/{os.path.basename(p)[:-3]}.onnx',1e-4)
if a.cldnn:
    d=meta(a.out,'cldnn',name='CLDNN (CNN + BiLSTM + attention)',description='Raw 19-channel 8 s epochs',input='raw8',pooling='prob',acc=(.9138,212))
    for p in files(a.cldnn,'CLDNN_outerseed*_fold*_init*.pt'):
        ck=torch.load(p,map_location='cpu',weights_only=False);m=CLDNN(len(ck['channels']),ck['config']);m.load_state_dict(ck['state_dict'])
        export(CLW(m),rnd(4,1024,19),f'{d}/{os.path.basename(p)[:-3]}.onnx',1e-3)
if a.cnn:
    from tensorflow import keras
    d=meta(a.out,'cnn2',name='CNN2 (1 s raw epochs)',description='2-D CNN on 128 x 19 raw epochs',input='raw1',pooling='prob',max_epochs=300,acc=(.9138,212))
    for p in files(a.cnn,'CNN2_seed*_fold*.keras'):
        km=keras.models.load_model(p);x=rnd(8,128,19)
        export(CNNW(km),x,f'{d}/{os.path.basename(p)[:-6]}.onnx',1e-3,ref=lambda v:km.predict(v[...,None],verbose=0))
if a.classical:
    import joblib
    d=meta(a.out,'classical-svm',name='SVM + SPEC features',description='RBF SVM on 247 spectral/Hjorth features per 8 s epoch',input='spec247',pooling='decision',max_epochs=100,acc=(.9397,218))
    for p in files(a.classical,'CLASSICAL_SVM_SPEC_seed*_fold*.joblib'):
        ck=joblib.load(p);x=rnd(8,247)*2;sc,svm=ck['scaler'],ck['model']
        export(SVMW(sc,svm),x,f'{d}/{os.path.basename(p)[:-7]}.onnx',1e-3,ref=lambda v:svm.decision_function(sc.transform(v))[:,None])
print('Done. Copy the models/ folder next to the website (it is read by the Node server).')
