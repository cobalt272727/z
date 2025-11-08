function newtweet() {
    const header = document.getElementById('header');
    header.style.display = 'none';
    // ヘッダーのtransformをリセット
    header.style.transform = 'translateY(0)';
    // bodyのpadding-topをリセット（ヘッダー分のスペースを削除）
    document.body.style.paddingTop = '0';
    const tweetingArea = document.getElementById('tweeting-area');
    tweetingArea.style.display = 'block';
        document.getElementById('tweet').style.display = 'none';
        document.getElementById('tweetreload').style.display = 'none';
        document.getElementById('newtweet').style.display = 'none';
    document.getElementById('tweet-input').focus();
    
    // 文字数カウンターを表示
    document.getElementById('char-counter').style.display = 'flex';
    updateCharCount();
}
function cancelTweet() {
    const header = document.getElementById('header');
    header.style.display = 'block';
    // ヘッダーのtransformを元に戻す
    header.style.transform = 'translateY(0)';
    // bodyのpadding-topを元に戻す
    document.body.style.paddingTop = '92px';
    const tweetingArea = document.getElementById('tweeting-area');
    document.getElementById('tweet').style.display = 'block';
            document.getElementById('tweetreload').style.display = 'flex';
        document.getElementById('newtweet').style.display = 'block';
    tweetingArea.style.display = 'none';
    document.getElementById('tweet-input').value = '';
    
    // 文字数カウンターを非表示
    document.getElementById('char-counter').style.display = 'none';
}

// 文字数カウンターを更新する関数
function updateCharCount() {
    const input = document.getElementById('tweet-input');
    const charCount = document.querySelector('.char-count');
    const progressCircle = document.querySelector('.progress-ring-circle');
    const counter = document.getElementById('char-counter');
    const maxLength = 100;
    
    const currentLength = input.value.length;
    const percentage = currentLength / maxLength;
    
    // 円周の長さ (2 * π * r = 2 * π * 16)
    const circumference = 2 * Math.PI * 16;
    
    // 進捗に応じてstroke-dashoffsetを計算
    const offset = circumference - (percentage * circumference);
    progressCircle.style.strokeDashoffset = offset;
    
    // テキスト更新
    charCount.textContent = `${currentLength}/${maxLength}`;
    
    // 警告色の設定
    counter.classList.remove('warning', 'danger');
    if (currentLength >= 80 && currentLength < 90) {
        counter.classList.add('warning');
    } else if (currentLength >= 90) {
        counter.classList.add('danger');
    }
}

// イベント委譲を使ったいいねボタンのクリック処理
document.addEventListener("click", async (event) => {
  // クリックされた要素が.iineクラスまたはその子要素か確認
  const iineBtn = event.target.closest(".iine");
  
  if (iineBtn) {
    console.log("いいねボタンがクリックされました");
    
    const id = iineBtn.getAttribute("data-tweet-id");
    
    if (!id) {
      console.error("ツイートIDが見つかりません");
      return;
    }
    
    // ログイン中のユーザーのメールアドレスを取得
    const isLoggedIn = await window.magic.user.isLoggedIn();
    
    if (!isLoggedIn) {
      alert("ログインしていません");
      return;
    }
    
    const metadata = await window.magic.user.getInfo();
    const email = metadata.email;
    
    // DIDトークンを取得
    const didToken = await window.magic.user.getIdToken();
    
    // サーバーにPOSTリクエストを送信
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/iine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${didToken}`
      },
      body: JSON.stringify({ id })
    });

    const result = await response.json();

    console.log(result);

    if (result.status === "success") {
      const iineIcon = iineBtn.querySelector(".iine-icon");
      const iineNum = iineBtn.querySelector(".iine-num");
      const currentNum = parseInt(iineNum.innerText);
      
      if (result.action === "liked") {
        // いいねを追加
        iineIcon.innerText = "♥";
        iineIcon.style.color = "rgb(216, 65, 126)";
        iineNum.innerText = currentNum + 1;
        iineBtn.setAttribute("data-liked", "true");
      } else if (result.action === "unliked") {
        // いいねを取り消し
        iineIcon.innerText = "♡";
        iineIcon.style.color = "";
        iineNum.innerText = currentNum - 1;
        iineBtn.setAttribute("data-liked", "false");
      }
    }
  }
});

// 送信中フラグ
let isSending = false;

// テキストエリアに入力イベントを設定
document.getElementById('tweet-input').addEventListener('input', updateCharCount);

document.getElementById("send-tweet-btn").addEventListener("click", async () => {
      // 送信中の場合は処理をスキップ
      if (isSending) {
        console.log("送信中のため、処理をスキップします");
        return;
      }

      const message = document.getElementById("tweet-input").value.trim();
      
      // メッセージが空の場合は送信しない
      if (!message || message.length === 0) {
        alert("メッセージを入力してください");
        return;
      }
      
      // Magic.linkからログイン中のユーザー情報を取得
      const isLoggedIn = await window.magic.user.isLoggedIn();
      
      if (!isLoggedIn) {
        alert("ログインしていません");
        return;
      }
      
      const metadata = await window.magic.user.getInfo();
      const email = metadata.email;
      
      // DIDトークンを取得
      const didToken = await window.magic.user.getIdToken();

      // 送信中フラグを立てる
      isSending = true;
      
      // ボタンを無効化し、視覚的にフィードバック
      const sendBtn = document.getElementById("send-tweet-btn");
      const originalBgColor = sendBtn.style.backgroundColor;
      const originalText = sendBtn.querySelector("p").textContent;
      sendBtn.style.backgroundColor = "#999";
      sendBtn.style.cursor = "not-allowed";
      sendBtn.querySelector("p").textContent = "送信中...";

      try {
        // サーバーにPOSTリクエストを送信
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${didToken}`
          },
          body: JSON.stringify({ message })
        });

        const result = await response.json();
        
        // BANされている場合の処理
        if (response.status === 403) {
          alert("⚠ " + result.message);
          cancelTweet();
          return;
        }
        
        // 不適切なコンテンツが検出された場合の処理
        if (response.status === 400 && result.categories) {
          alert("⚠ " + result.message + "\n\nこの投稿は不適切なコンテンツを含んでいる可能性があります。");
          return;
        }
        
        // エラーチェック
        if (result.status === "error") {
          alert("エラー: " + result.message);
          return;
        }
        
        // ツイート送信後、ツイート一覧を再読み込み
        if (typeof loadTweets === 'function') {
          cancelTweet();
          loadTweets();
        }
      } catch (error) {
        console.error("送信エラー:", error);
        alert("送信中にエラーが発生しました");
      } finally {
        // 送信中フラグを解除
        isSending = false;
        
        // ボタンを元に戻す
        sendBtn.style.backgroundColor = originalBgColor || "#1DA1F2";
        sendBtn.style.cursor = "pointer";
        sendBtn.querySelector("p").textContent = originalText;
      }
    });