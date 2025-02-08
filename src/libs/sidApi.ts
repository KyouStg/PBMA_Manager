"use client"
import { invoke } from '@tauri-apps/api/tauri';


// SID情報を取得する関数
export const GetSidInfo = async (sid: string) => {
  try {
    // TauriのバックエンドでRust関数を呼び出す
    const sidData = await invoke('get_sid_data', { sid });
    return sidData ;
  } catch (error) {
    throw new Error('Failed to fetch SID data: ' + error);
  }
};

// プロキシ情報を取得する関数
export const GetProxyInfo = async (sid: string, wNum: string) => {
  try {
    // TauriのバックエンドでRust関数を呼び出す
    const proxyData  = await invoke('get_window_data', { sid, wNum });
    return { proxyData };
  } catch (error) {
    throw new Error('Failed to fetch Proxy data: ' + error);
  }
};
