// メールリンクを送信
async function sendLoginLink() {
    const email = document.getElementById('email-input').value;
    
    if (!email) {
        alert('メールアドレスを入力してください。');
        return;
    }
    
    // ドメインチェック
    if (!email.endsWith('@g.kumamoto-nct.ac.jp')) {
        alert('このサイトは g.kumamoto-nct.ac.jp ドメインのアカウントのみアクセス可能です。');
        return;
    }
    
    
    try {
        document.getElementById('loading-message').style.display = 'block';
        document.getElementById('email-input-section').style.display = 'none';
        
        // popcketbaseでOTPを送信
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();
        if (result.status !== "success") {
        }
        
        document.getElementById('loading-message').style.display = 'none';
        
        console.log('ログイン成功: ' + email);
        
        // ログイン状態を確認
        await checkAuthState();
        
    } catch (error) {
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('email-input-section').style.display = 'block';
        
        console.error('ログインエラー:', error);
        alert('ログインに失敗しました: ' + error.message);
    }
}

// ユーザーをデータベースに登録
async function registerUserToDatabase(email) {
    try {
        // DIDトークンを取得
        const didToken = await window.magic.user.getIdToken();
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/register-user`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${didToken}`
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();
        
        if (result.status === "success") {
            console.log('新規ユーザー登録完了:', result);
        } else if (result.status === "already_exists") {
            console.log('ユーザーは既に登録済み');
        } else {
            console.error('ユーザー登録エラー:', result);
        }
    } catch (error) {
        console.error('ユーザー登録APIエラー:', error);
    }
}

// 認証状態をチェック
async function checkAuthState() {
    try {
        // Magic SDKが初期化されるまで待機
        if (!window.magic) {
            console.log('Magic SDK is not initialized yet');
            showLoginScreen();
            return;
        }
        
        const isLoggedIn = await window.magic.user.isLoggedIn();
        
        if (isLoggedIn) {
            const metadata = await window.magic.user.getInfo();
            const email = metadata.email;
            
            console.log('ログイン中:', email);
            
            // ドメインチェック
            if (!email.endsWith('@g.kumamoto-nct.ac.jp')) {
                alert('アクセスが拒否されました。\nこのサイトは g.kumamoto-nct.ac.jp ドメインのアカウントのみアクセス可能です。');
                await signOut();
                return;
            }
            
            // データベースにユーザーを登録（既存の場合はスキップ）
            await registerUserToDatabase(email);
            
            hideLoginScreen();
        } else {
            console.log('未ログイン');
            showLoginScreen();
        }
    } catch (error) {
        console.error('認証状態チェックエラー:', error);
        showLoginScreen();
    }
}

// サインアウト
async function signOut() {
    try {
        await window.magic.user.logout();
        console.log('サインアウトしました');
        showLoginScreen();
    } catch (error) {
        console.error('サインアウトエラー:', error);
        alert('サインアウトに失敗しました: ' + error.message);
    }
}

// ログイン画面を表示
function showLoginScreen() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('email-input-section').style.display = 'block';
    document.getElementById('link-sent-message').style.display = 'none';
    document.getElementById('loading-message').style.display = 'none';
}

// 現在のソート状態を保持
let currentSort = 'toukou'; // デフォルトは投稿順

// ツイートをデータベースから取得して表示
async function loadTweets(sortType = currentSort) {
    // ローディング表示
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        
        // bodyのpadding-topの値を取得してローディングオーバーレイのtopに適用
        const bodyPaddingTop = getComputedStyle(document.body).paddingTop;
        loadingOverlay.style.top = bodyPaddingTop;
    }
    
    try {
        // ログイン中のユーザーのメールアドレスを取得
        const isLoggedIn = await window.magic.user.isLoggedIn();
        
        // ログインしていない場合は処理を中断
        if (!isLoggedIn) {
            console.log('ログインが必要です');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            showLoginScreen();
            return;
        }
        
        const metadata = await window.magic.user.getInfo();
        const email = metadata.email;
        
        // DIDトークンを取得
        const didToken = await window.magic.user.getIdToken();
        
        // ソートパラメータをクエリストリングに追加
        const sortParam = sortType === 'likes' ? '?sort=likes' : '?sort=toukou';
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/tweets${sortParam}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${didToken}`
            }
        });
        const result = await response.json();
        
        if (result.status === "success") {
            const tweetContainer = document.querySelector('.tweet');
            // 既存のツイートをクリア
            tweetContainer.innerHTML = '';
            
            const likedTweetIds = result.likedTweetIds || [];
            
            // サーバー側で既にソート済みなので、そのまま使用
            let tweets = result.tweets;
            
            // 現在のソート状態を保存
            currentSort = sortType;
            
            // 各ツイートを表示
            tweets.forEach(tweet => {
                const tweetBox = document.createElement('div');
                tweetBox.className = `tweetbox id-${tweet.id}`;
                
                const timeAgo = getTimeAgo(tweet.time);
                const isLiked = likedTweetIds.includes(tweet.id);
                const iineIcon = isLiked ? '♥' : '♡';
                const iineColor = isLiked ? 'rgb(216, 65, 126)' : '';
                
                tweetBox.innerHTML = `
                    <img class="tweeticon" src="svg/kkrn_icon_user_${tweet.icon}.svg" alt="">
                    <div class="tweetright">
                        <div class="rtop">
                            <p class="username">${escapeHtml(tweet.name)}</p>
                            <p class="timestamp">${timeAgo}</p>
                        </div>
                        <div class="rbottom">
                            <p class="content">${formatHashtags(tweet.message)}</p>
                            <div class="iine" data-tweet-id="${tweet.id}" data-liked="${isLiked}">
                                <p class="iine-icon" style="color: ${iineColor}">${iineIcon}</p>
                                <p class="iine-num">${tweet.iine}</p>
                            </div>
                        </div>
                    </div>
                `;
                
                tweetContainer.appendChild(tweetBox);
            });
              window.scroll({ 
            top: 0, 
            behavior: "smooth"
            });
            console.log('ツイートを読み込みました:', result.tweets.length + '件');
        } else {
            console.error('ツイート取得エラー:', result);
        }
    } catch (error) {
        console.error('ツイート取得APIエラー:', error);
    } finally {
        // ローディング非表示
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// HTMLエスケープ関数(XSS対策)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ハッシュタグを装飾する関数
function formatHashtags(text) {
    // まずHTMLエスケープ
    const escapedText = escapeHtml(text);
    
    // #から次の空白(またはテキスト末尾)までをハッシュタグとして認識
    // 改行、スペース、タブで終了
    const hashtagRegex = /#[^\s#]+/g;
    
    return escapedText.replace(hashtagRegex, (match) => {
        return `<span class="hashtag">${match}</span>`;
    });
}

// 経過時間を計算する関数
function getTimeAgo(timestamp) {
    const now = new Date();
    const tweetTime = new Date(timestamp);
    const diffMs = now - tweetTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
        return diffSeconds + '秒前';
    } else if (diffMinutes < 60) {
        return diffMinutes + '分前';
    } else if (diffHours < 24) {
        return diffHours + '時間前';
    } else if (diffDays < 30) {
        return diffDays + '日前';
    } else if (diffMonths < 12) {
        return diffMonths + 'ヶ月前';
    } else {
        return diffYears + '年前';
    }
}

// ログイン画面を非表示
function hideLoginScreen() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    
    // ツイートを読み込む（ローディング表示付き）
    loadTweets();
}

// ページ読み込み時の処理
window.addEventListener('load', async function() {
    // Magic SDKの初期化を待つ
    const waitForMagic = setInterval(async () => {
        if (window.magic) {
            clearInterval(waitForMagic);
            
            // 認証状態をチェック
            await checkAuthState();
        }
    }, 100);
    
    // タイムアウト設定（10秒）
    setTimeout(() => {
        clearInterval(waitForMagic);
        if (!window.magic) {
            console.error('Magic SDK failed to initialize');
            showLoginScreen();
        }
    }, 10000);
    
    // ログインボタンのイベントリスナー
    const sendLinkBtn = document.getElementById('send-link-btn');
    if (sendLinkBtn) {
        sendLinkBtn.addEventListener('click', sendLoginLink);
    }
    
    // Enterキーでもログインリンクを送信
    const emailInput = document.getElementById('email-input');
    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendLoginLink();
            }
        });
    }
    
    // ソート切り替えのイベントリスナー
    const toukouBtn = document.getElementById('toukou');
    const likesBtn = document.getElementById('likes');
    
    if (toukouBtn) {
        toukouBtn.addEventListener('click', function() {
            // アクティブ状態を切り替え
            toukouBtn.classList.add('active');
            likesBtn.classList.remove('active');
            // 投稿順で読み込み
            loadTweets('toukou');
        });
    }
    
    if (likesBtn) {
        likesBtn.addEventListener('click', function() {
            // アクティブ状態を切り替え
            likesBtn.classList.add('active');
            toukouBtn.classList.remove('active');
            // いいね順で読み込み
            loadTweets('likes');
        });
    }
});
