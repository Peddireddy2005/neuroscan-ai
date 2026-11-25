import {createContext,useContext} from 'react';
export const Ctx=createContext({user:null,setUser:()=>{}});
export const useAuth=()=>useContext(Ctx);
