function newtweet() {
    const header = document.getElementById('header');
    header.style.display = 'none';
    const tweetingArea = document.getElementById('tweeting-area');
    tweetingArea.style.display = 'block';
        document.getElementById('tweet').style.display = 'none';
    document.getElementById('tweet-input').focus();
}
function cancelTweet() {
    const header = document.getElementById('header');
    header.style.display = 'flex';
    const tweetingArea = document.getElementById('tweeting-area');
    document.getElementById('tweet').style.display = 'block';
    tweetingArea.style.display = 'none';
    document.getElementById('tweet-input').value = '';
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
    
    // サーバーにPOSTリクエストを送信
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/iine`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, email })
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

document.getElementById("send-tweet-btn").addEventListener("click", async () => {
      const message = document.getElementById("tweet-input").value;
      
      // Magic.linkからログイン中のユーザー情報を取得
      const isLoggedIn = await window.magic.user.isLoggedIn();
      
      if (!isLoggedIn) {
        alert("ログインしていません");
        return;
      }
      
      const metadata = await window.magic.user.getInfo();
      const email = metadata.email;



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
    });