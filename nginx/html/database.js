import PocketBase from "https://cdn.jsdelivr.net/npm/pocketbase/+esm";
const pb = new PocketBase(window.APP_CONFIG.POCKETBASE_URL);

function newtweet() {
    // 注意メッセージを表示するかチェック
    const dontShowAgain = localStorage.getItem('dontShowDisplayMessage');
    
    if (!dontShowAgain) {
        showDisplayMessage();
    }
    
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

// 映像表示に関する注意メッセージを表示
function showDisplayMessage() {
    const overlay = document.createElement('div');
    overlay.className = 'display-message-overlay';
    
    const messageBox = document.createElement('div');
    messageBox.className = 'display-message-box';
    
    messageBox.innerHTML = `
        <h3>映像表示について</h3>
        <p>映像に流れるのは<strong>30文字以下の投稿のみ</strong>です</p>
        <div class="checkbox-container">
            <input type="checkbox" id="dont-show-again" />
            <label for="dont-show-again">このメッセージを今後表示しない</label>
        </div>
        <button class="confirm-btn" id="confirm-display-message">OK</button>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    
    // OKボタンのイベントリスナー
    document.getElementById('confirm-display-message').addEventListener('click', () => {
        const checkbox = document.getElementById('dont-show-again');
        if (checkbox.checked) {
            localStorage.setItem('dontShowDisplayMessage', 'true');
        }
        overlay.remove();
    });
    
    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}
function cancelTweet() {
    const header = document.getElementById('header');
    header.style.display = 'block';
    // ヘッダーのtransformを元に戻す
    header.style.transform = 'translateY(0)';
    // bodyのpadding-topを元に戻す
    document.body.style.paddingTop = '98px';
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
    if (currentLength > 30 && currentLength < 90) {
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

    const iineIcon = iineBtn.querySelector(".iine-icon");
    const iineNum = iineBtn.querySelector(".iine-num");
    const currentNum = parseInt(iineNum.innerText);
    const isLiked = iineBtn.getAttribute("data-liked") === "true";
    
    // 楽観的UI更新（先にアニメーション）
    if (!isLiked) {
      // いいねを追加する場合
      // 円のアニメーション要素を作成
      const circle = document.createElement('div');
      circle.className = 'iine-animation-circle active';
      iineBtn.appendChild(circle);
      
      // ハートアイコンを一旦非表示
      iineIcon.style.opacity = '0';
      
      // 少し遅延してハートを表示
      setTimeout(() => {
        iineIcon.innerText = "♥";
        iineIcon.style.color = "rgb(216, 65, 126)";
        iineIcon.style.opacity = '1';
        iineIcon.classList.add('heart-pop');
        
        // アニメーション終了後にクラスを削除
        setTimeout(() => {
          iineIcon.classList.remove('heart-pop');
          circle.remove();
        }, 600);
      }, 100);
      
      iineNum.innerText = currentNum + 1;
      iineBtn.setAttribute("data-liked", "true");
    } else {
      // いいねを取り消す場合（即座に変更）
      iineIcon.innerText = "♡";
      iineIcon.style.color = "";
      iineNum.innerText = currentNum - 1;
      iineBtn.setAttribute("data-liked", "false");
    }
    
    // ログイン中のユーザーのメールアドレスを取得
    const isLoggedIn = pb.authStore.isValid;
    
    if (!isLoggedIn) {
      alert("ログインしていません");
      // 元に戻す
      if (!isLiked) {
        iineIcon.innerText = "♡";
        iineIcon.style.color = "";
        iineNum.innerText = currentNum;
        iineBtn.setAttribute("data-liked", "false");
      } else {
        iineIcon.innerText = "♥";
        iineIcon.style.color = "rgb(216, 65, 126)";
        iineNum.innerText = currentNum;
        iineBtn.setAttribute("data-liked", "true");
      }
      return;
    }

    

    try {
      // サーバーにPOSTリクエストを送信
      const email = pb.authStore.model.email;
      const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/iine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, email })
      });

      const result = await response.json();

      console.log(result);

      // 失敗した場合は元に戻す
      if (result.status !== "success") {
        if (!isLiked) {
          iineIcon.innerText = "♡";
          iineIcon.style.color = "";
          iineNum.innerText = currentNum;
          iineBtn.setAttribute("data-liked", "false");
        } else {
          iineIcon.innerText = "♥";
          iineIcon.style.color = "rgb(216, 65, 126)";
          iineNum.innerText = currentNum;
          iineBtn.setAttribute("data-liked", "true");
        }
        alert("いいねの処理に失敗しました");
      }
    } catch (error) {
      console.error("いいねAPIエラー:", error);
      // エラー時も元に戻す
      if (!isLiked) {
        iineIcon.innerText = "♡";
        iineIcon.style.color = "";
        iineNum.innerText = currentNum;
        iineBtn.setAttribute("data-liked", "false");
      } else {
        iineIcon.innerText = "♥";
        iineIcon.style.color = "rgb(216, 65, 126)";
        iineNum.innerText = currentNum;
        iineBtn.setAttribute("data-liked", "true");
      }
      alert("通信エラーが発生しました");
    }
  }
});

// 送信中フラグ
let isSending = false;

// テキストエリアに入力イベントを設定
document.getElementById('tweet-input').addEventListener('input', updateCharCount);

// スマホでキーボード表示時にカウンターの位置を調整
const tweetInput = document.getElementById('tweet-input');
const charCounter = document.getElementById('char-counter');

// フォーカス時の処理
tweetInput.addEventListener('focus', () => {
    // スマホの場合、キーボードの上に表示されるように調整
    if (window.innerWidth <= 768) {
        // visualViewportが利用可能な場合（モダンブラウザ）
        if (window.visualViewport) {
            const updateCounterPosition = () => {
                const viewportHeight = window.visualViewport.height;
                const windowHeight = window.innerHeight;
                const keyboardHeight = windowHeight - viewportHeight;
                
                if (keyboardHeight > 100) {
                    // キーボードが表示されている場合
                    charCounter.style.bottom = `${keyboardHeight + 20}px`;
                    charCounter.style.transition = 'bottom 0.3s ease';
                }
            };
            
            // visualViewportのリサイズを監視
            window.visualViewport.addEventListener('resize', updateCounterPosition);
            window.visualViewport.addEventListener('scroll', updateCounterPosition);
            updateCounterPosition();
            
            // フォーカスが外れた時にイベントリスナーを削除
            tweetInput.addEventListener('blur', () => {
                window.visualViewport.removeEventListener('resize', updateCounterPosition);
                window.visualViewport.removeEventListener('scroll', updateCounterPosition);
                charCounter.style.bottom = '20px';
                charCounter.style.transition = 'bottom 0.3s ease';
            }, { once: true });
        } else {
            // フォールバック: 固定位置を上に移動
            charCounter.style.bottom = '220px';
            charCounter.style.transition = 'bottom 0.3s ease';
        }
    }
});

// ブラー時の処理
tweetInput.addEventListener('blur', () => {
    // 元の位置に戻す
    setTimeout(() => {
        charCounter.style.bottom = '20px';
    }, 100);
});

document.getElementById("newtweet").addEventListener("click", newtweet);
document.getElementById("cancel-btn").addEventListener("click", cancelTweet);

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
      const isLoggedIn = pb.authStore.isValid;
      
      if (!isLoggedIn) {
        alert("ログインしていません");
        return;
      }
      


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
        const email = pb.authStore.model.email;
        // サーバーにPOSTリクエストを送信
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ message, email })
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