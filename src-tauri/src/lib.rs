use std::fs;
use std::fs::File;
use std::io::Write;
use tauri::command;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::path::{Path};
use reqwest;

#[derive(Deserialize)]
struct PluginData {
  w_num: u32,
  proxy_ip: String,
  proxy_port: String,
  proxy_user: String,
  proxy_pass: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct SidResponse {
    sid: String,
    bootWindowNum: i32,
}

#[derive(Deserialize, Serialize, Debug)]
struct WindowResponse {
    proxyIp: String,
    proxyPort: String,
    proxyUser: String,
    proxyPass: String,
    sid: String,
    windowNumber: String,
}


#[command]
async fn get_sid_data(sid: String) -> Result<SidResponse, String> {
    let url = format!("https://dynoset-web-api.fly.dev/amb/api/v4/config/{}", sid);
    let response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?
        .json::<SidResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response)
}

#[command]
async fn get_window_data(sid: String, w_num: String) -> Result<WindowResponse, String> {
    let url = format!(
        "https://dynoset-web-api.fly.dev/amb/api/v4/config/per-window/{}/{}",
        sid, w_num
    );
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json::<WindowResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response)
}

#[command]
fn create_plugin(data: PluginData) -> Result<(), String> {
    // 実行ファイルのディレクトリを取得
    let exe_dir = env::current_exe().unwrap().parent().unwrap().to_path_buf();
    
    // window_proxies/W{w_num} のディレクトリを exe_dir に作成
    let window_dir = format!("amb/window_proxies/W{}", data.w_num);
    let plugin_dir = exe_dir.join(window_dir);

    println!("Plugin directory: {}", plugin_dir.display());
    // プラグインディレクトリが存在しない場合は作成
    if !plugin_dir.exists() {
        fs::create_dir_all(&plugin_dir).map_err(|e| e.to_string())?;
    } 

    // プロキシデータの検証
    if data.proxy_ip.is_empty() || data.proxy_port.is_empty() || data.proxy_user.is_empty() || data.proxy_pass.is_empty() {
        return Err("Invalid plugin data: Some fields are empty".to_string());
    }

    // manifest.json の内容を作成
    let manifest_content = json!({
        "version": "1.0.0",
        "manifest_version": 2,
        "name": format!("Proxy Plugin W{}", data.w_num),
        "permissions": [
            "proxy",
            "tabs",
            "unlimitedStorage",
            "storage",
            "<all_urls>",
            "webRequest",
            "webRequestBlocking"
        ],
        "background": {
            "scripts": ["background.js"]
        },
        "minimum_chrome_version": "22.0.0"
    });

    // manifest.json ファイルの作成
    let manifest_path = plugin_dir.join("manifest.json");
    let manifest_json = serde_json::to_string_pretty(&manifest_content).map_err(|e| e.to_string())?;
    let mut manifest_file = File::create(&manifest_path).map_err(|e| e.to_string())?;
    manifest_file.write_all(manifest_json.as_bytes()).map_err(|e| e.to_string())?;

    // background.js の内容を作成
    let background_js_content = format!(
        r#"
        var config = {{
            mode: "fixed_servers",
            rules: {{
                singleProxy: {{
                    scheme: "http",
                    host: "{}",
                    port: parseInt("{}")
                }},
                bypassList: ["foober.com"]
            }}
        }};
        chrome.proxy.settings.set({{ value: config, scope: "regular" }}, function() {{}});

        function callbackFn(details) {{
            return {{
                authCredentials: {{
                    username: "{}",
                    password: "{}"
                }}
            }};
        }}
        chrome.webRequest.onAuthRequired.addListener(
            callbackFn,
            {{ urls: ["<all_urls>"] }},
            ["blocking"]
        );
        "#,
        data.proxy_ip, data.proxy_port, data.proxy_user, data.proxy_pass
    );

    // background.js ファイルの作成
    let background_path = plugin_dir.join("background.js");
    let mut background_file = File::create(&background_path).map_err(|e| e.to_string())?;
    background_file.write_all(background_js_content.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}


#[command]
fn register_window(window_number: u32) -> Result<(), String> {
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory".to_string())?;

    let user_data_path = if cfg!(target_os = "windows") {
        home_dir.join("AppData\\Local\\Google\\Chrome\\User Data")
    } else if cfg!(target_os = "macos") {
        home_dir.join("Library/Application Support/Google/Chrome")
    } else {
        home_dir.join(".config/google-chrome")
    };

    let pbma_path = user_data_path
      .parent()
      .ok_or("Failed to get parent directory")?
      .join(format!("PBMA {}", window_number));
    
    // User Dataが存在する場合、PBMA {windowNumber} にコピー
    if user_data_path.exists() {
      // まず、pbma_path がすでに存在する場合は削除してから、新しいディレクトリを作成
      if pbma_path.exists() {
        fs::remove_dir_all(&pbma_path).map_err(|e| e.to_string())?;
      }

      // コピー処理を先に行う
      fs::create_dir_all(&pbma_path).map_err(|e| e.to_string())?;
      copy_dir(&user_data_path, &pbma_path)?;

      // コピー後に user_data_path を削除
      fs::remove_dir_all(&user_data_path).map_err(|e| e.to_string())?;
    } else {
        return Err("User Data directory does not exist".to_string());
    }
    Ok(())
}


fn copy_dir(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err("Source directory does not exist".to_string());
    }

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
            copy_dir(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[command]
fn initialize_chrome_data() -> Result<(), String> {
    let home_dir = dirs::home_dir().ok_or("Failed to get home directory".to_string())?;
    let chrome_path = home_dir.join("AppData\\Local\\Google\\Chrome");

    // 指定したパスが存在する場合、その中身を削除
    if chrome_path.exists() {
        // フォルダー内のファイルやサブディレクトリを削除
        for entry in fs::read_dir(&chrome_path).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                fs::remove_dir_all(&path).map_err(|e| e.to_string())?; // サブディレクトリの削除
            } else {
                fs::remove_file(&path).map_err(|e| e.to_string())?; // ファイルの削除
            }
        }
    } else {
        return Err("Chrome directory does not exist".to_string());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![create_plugin, register_window, initialize_chrome_data, get_sid_data, get_window_data])
    .setup(|_app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}