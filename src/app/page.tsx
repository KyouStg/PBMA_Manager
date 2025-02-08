"use client";
import { GetProxyInfo, GetSidInfo } from "@/libs/sidApi";
import { invoke } from "@tauri-apps/api/tauri";
import { useState } from "react";

// エラーモーダルコンポーネント
const ErrorModal = ({ message, onClose }: { message: string; onClose: () => void }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded shadow-lg max-w-md w-full">
        <p className="mt-2 text-red-700 break-words whitespace-pre-line">{message}</p>
        <button onClick={onClose} className="bg-blue-500 text-white mx-auto w-20 flex justify-center px-4 py-2 mt-4 rounded">
          OK
        </button>
      </div>
    </div>
  );
};

// モーダルコンポーネント
const MessageModal = ({ message, onClose }: { message: string; onClose: () => void }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded shadow-lg max-w-md w-full">
        <p className="mt-2 text-zinc-700 break-words whitespace-pre-line">{message}</p>
        <button onClick={onClose} className="bg-blue-500 text-white mx-auto w-20 flex justify-center px-4 py-2 mt-4 rounded">
          OK
        </button>
      </div>
    </div>
  );
};

// 確認モーダル
const ConfirmModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded shadow-lg max-w-md w-full">
        <p className="mt-2 text-zinc-700 break-words whitespace-pre-line">{message}</p>
        <div className="flex gap-4 justify-center mt-4">
          <button onClick={onConfirm} className="bg-blue-500 text-white w-20 flex justify-center px-4 py-2 rounded">
            はい
          </button>
          <button onClick={onCancel} className="bg-blue-500 text-white w-20 flex justify-center px-4 py-2 rounded">
            いいえ
          </button>
        </div>
      </div>
    </div>
  );
};


export default function Home() {
  const [sid, setSid] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [confirmPluginMessage, setConfirmPluginMessage] = useState("");
  const [confirmWindowMessage, setConfirmWindowMessage] = useState("");
  const [confirmInitializeMessage, setConfirmInitializeMessage] = useState("");
  const [isPluginLoading, setIsPluginLoading] = useState(false);
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [bootWindowNum, setBootWindowNum] = useState<number | null>(null);
  const [windowNumberToRegister, setWindowNumberToRegister] = useState<number | null>(null);

  // SID 情報取得とプラグイン作成処理
  const handleSidAndCreatePlugin = async () => {
    if (!sid.trim()) {
      setErrorMessage("SID を入力してください。");
      return;
    }
    setConfirmPluginMessage(`プラグインを作成しますか？`)
  }

  const handlePluginConfirm = async () => {
    try {
      setIsPluginLoading(true);
      setErrorMessage("");
      
      // SID 情報を取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { bootWindowNum }: any = await GetSidInfo(sid);
      setBootWindowNum(bootWindowNum);
      console.log(bootWindowNum);
      // プラグイン作成処理
      for (let wNum = 1; wNum <= bootWindowNum; wNum++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { proxyData }: any = await GetProxyInfo(sid, wNum.toString());
        const { proxyIp, proxyPort, proxyUser , proxyPass } = proxyData;

        await invoke("create_plugin", {
          data: {
            w_num: wNum,
            proxy_ip: proxyIp,
            proxy_port: proxyPort,
            proxy_user: proxyUser,
            proxy_pass: proxyPass,
          },
        });
      }
      setMessage(`プラグインの作成(${bootWindowNum})に成功しました。`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log("Caught plugin error: ", error);
        
      } finally {
        setIsPluginLoading(false);
    }
  };

  // 窓登録処理
  const handleRegisterWindow = (windowNumber: number) => {
    setWindowNumberToRegister(windowNumber); // 窓番号をセット
    setConfirmWindowMessage(`窓 ${windowNumber} を登録しますか？`); // 確認モーダルを表示
  };


  const handleWindowConfirm  = async () => {
    console.log(bootWindowNum);
    if (windowNumberToRegister === null) {
      return;
    }

    try {
      console.log(`Registering window ${windowNumberToRegister} for SID: ${sid}`);
      await invoke("register_window", { windowNumber: windowNumberToRegister });
      setMessage(`窓(${windowNumberToRegister})の登録に成功しました。`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.log("Caught error: ", error);
      if (error) {
        // 'os error 32' を特定して、メッセージを設定
        if (error.includes("os error 32")) {
          setErrorMessage(`別のプロセスがリソースを使用中です。\n稼働中のChromeを閉じて再度お試しください。`);
        } else if (error.includes("User Data directory does not exist")) {
          setErrorMessage(`User Dataが見つかりませんでした。`);
        }
        else {
          setErrorMessage(`窓 ${windowNumberToRegister} の登録に失敗しました: ${error}`);
        }
      } else {
        setErrorMessage("予期しないエラーが発生しました");
      }
    }
  };

  // 初期化処理
  const handleConfirmInitialization = () => {
    setConfirmInitializeMessage("本当に初期化しますか？");
  };

  // 初期化処理を呼び出す関数
  const handleInitializeChrome = async () => {
    try {
      setIsInitLoading(true);
      setErrorMessage("");

      // 初期化処理
      await invoke("initialize_chrome_data");
      setMessage("初期化されました。");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.log("Caught error: ", error);
      if (error) {
        // 'os error 32' を特定して、メッセージを設定
        if (error.includes("os error 32")) {
          setErrorMessage(`別のプロセスがリソースを使用中です。\n稼働中のChromeを閉じて再度お試しください。`);
        } else if (error.includes("Chrome directory does not exist")) {
          setErrorMessage(`Chromeが見つかりませんでした。`);
        }
        else {
          setErrorMessage("初期化に失敗しました。");
        }
      } else {
        setErrorMessage("予期しないエラーが発生しました");
      }
    
    } finally {
      setIsInitLoading(false);
    }
  };


  return (
    <div className="flex flex-col w-screen h-screen justify-center items-center p-4 bg-white text-black">
      <h1 className="text-xl font-bold pb-4">PBMA Manager</h1>

      {/* SID 入力フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="SID を入力..."
          value={sid}
          onChange={(e) => setSid(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <button
          onClick={handleSidAndCreatePlugin}
          className="bg-green-800 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isPluginLoading}
        >
          {isPluginLoading ? "処理中..." : "プラグイン作成"}
        </button>
      </div>

      {/* メッセージ表示 */}
      {errorMessage && <ErrorModal message={errorMessage} onClose={() => setErrorMessage("")} />}
      {message && <MessageModal message={message} onClose={() => setMessage("")} />}
      {confirmPluginMessage && (
        <ConfirmModal
          message={confirmPluginMessage}
          onConfirm={() => {
            setConfirmPluginMessage("");
            handlePluginConfirm();
          }}
          onCancel={() => {
            setConfirmPluginMessage("");
          }}
        />
      )}
      {confirmWindowMessage && (
        <ConfirmModal
          message={confirmWindowMessage}
          onConfirm={() => {
            setConfirmWindowMessage(""); // モーダルを閉じる
            handleWindowConfirm();
          }}
          onCancel={() => setConfirmWindowMessage("")}
        />
      )}
      {confirmInitializeMessage && (
        <ConfirmModal
          message={confirmInitializeMessage}
          onConfirm={() => {
            setConfirmInitializeMessage(""); // モーダルを閉じる
            handleInitializeChrome();
          }}
          onCancel={() => setConfirmInitializeMessage("")}
        />
      )}

      {/* 窓登録ボタン */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {Array.from({ length: 20 }, (_, i) => i).map((i) => (
          <button
            key={i}
            onClick={() => handleRegisterWindow(i + 1)}
            className="bg-blue-700 text-white px-4 py-2 rounded"
          >
            窓 {i + 1} を登録
          </button>
        ))}
      </div>
      <button
          onClick={handleConfirmInitialization}
          className="bg-orange-500 text-white px-4 py-2 rounded disabled:opacity-50 mt-10"
          disabled={isInitLoading}
        >
          {isInitLoading ? "初期化中..." : "初期化"}
        </button>
    </div>
  );
}
