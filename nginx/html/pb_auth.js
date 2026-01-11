import PocketBase from "./pb.js";
import { escapeHtml, formatHashtags, getTimeAgo, showDisplayMessage } from './utils.js';

const pb = new PocketBase(window.APP_CONFIG.POCKETBASE_URL);
let otpId;

// 認証状態をチェック
async function checkAuthState() {
    try {
        
        const isLoggedIn = pb.authStore.isValid;
        
        if (isLoggedIn) {
            const metadata = await pb.collection('users').getOne(pb.authStore.model.id);
            const email = metadata.email;
            
            console.log('ログイン中:', email);
            
            // ドメインチェック
            if (!email.endsWith('@g.kumamoto-nct.ac.jp')) {
                showDisplayMessage({
                    title: 'アクセス拒否',
                    message: 'このサイトは g.kumamoto-nct.ac.jp ドメインのアカウントのみアクセス可能です。',
                    showCheckbox: false
                });
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
        await pb.authStore.clear();
        console.log('サインアウトしました');
        showLoginScreen();
    } catch (error) {
        console.error('サインアウトエラー:', error);
        showDisplayMessage({
            title: 'サインアウトエラー',
            message: 'サインアウトに失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
    }
}

// ユーザーをデータベースに登録
async function registerUserToDatabase(email) {
    try {
        console.log('ユーザー登録処理:', email);
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/register-user`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${pb.authStore.token}`
            }
        });

        const result = await response.json();

        document.getElementById('mypage-icon').src = `svg/kkrn_icon_user_${result.icon}.svg`;
        document.getElementById('go-mypage-icon').src = `svg/kkrn_icon_user_${result.icon}.svg`; 
        document.getElementById('tweeting-icon').src = `svg/kkrn_icon_user_${result.icon}.svg`;
        
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
        const isLoggedIn = pb.authStore.isValid;
        
        // ログインしていない場合は処理を中断
        if (!isLoggedIn) {
            console.log('ログインが必要です');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            showLoginScreen();
            return;
        }
        // ソートパラメータをクエリストリングに追加
        const sortParam = sortType === 'likes' ? '?sort=likes' : '?sort=toukou';
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/tweets${sortParam}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${pb.authStore.token}`
            }
            // GET/HEADリクエストではbodyを含めない
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
// ログイン画面を表示
function showLoginScreen() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('email-input-section').style.display = 'block';
    document.getElementById('loading-message').style.display = 'none';
}
// ログイン画面を非表示
function hideLoginScreen() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    
    // ツイートを読み込む（ローディング表示付き）
    loadTweets();
}
// メールリンクを送信
async function sendLoginLink() {
    var email = document.getElementById('email-input').value.trim();
    
    if (!email) {
        showDisplayMessage({
            title: '入力エラー',
            message: 'ユーザーIDを入力してください。',
            showCheckbox: false
        });
        return;
    }
    
    email = email + '@g.kumamoto-nct.ac.jp';
    
    try{
            const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/user-create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });
    } catch (error) {
        console.error('ログイン前処理エラー:', error);
        showDisplayMessage({
            title: 'ログインエラー',
            message: 'ログイン処理に失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
        return; 
    }

    
    try {
        document.getElementById('loading-message').style.display = 'block';
        document.getElementById('email-input-section').style.display = 'none';
        
        // popcketbaseでOTPを送信
        const req = await pb.collection('users').requestOTP(email);
        otpId = req.otpId;
        
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('otp-input-section').style.display = 'block';
        
        
    } catch (error) {
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('email-input-section').style.display = 'block';
        
        console.error('ログインエラー:', error);
        showDisplayMessage({
            title: 'ログインエラー',
            message: 'OTPの送信に失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
    }
}
// OTP入力ボックスの自動フォーカス機能を初期化
function initOtpInputs() {
    const otpInputs = document.querySelectorAll('.otp-input');
    
    otpInputs.forEach((input, index) => {
        // 入力時のイベント
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // 1文字入力されたら次のボックスにフォーカス
            if (value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        
        // キーダウンイベント（削除キー対応）
        input.addEventListener('keydown', (e) => {
            // Backspaceキーが押され、現在のボックスが空の場合
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                e.preventDefault();
                const prevInput = otpInputs[index - 1];
                prevInput.focus();
                // カーソルを最後尾に移動
                setTimeout(() => {
                    prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
                }, 0);
            }
        });
        
        // ペースト対応
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').replace(/\D/g, ''); // 数字のみ抽出
            
            // 各ボックスに1文字ずつ入力
            for (let i = 0; i < pasteData.length && index + i < otpInputs.length; i++) {
                otpInputs[index + i].value = pasteData[i];
            }
            
            // 最後に入力されたボックスの次にフォーカス
            const lastFilledIndex = Math.min(index + pasteData.length, otpInputs.length - 1);
            otpInputs[lastFilledIndex].focus();
        });
    });
}

// OTPを検証してログイン
async function verifyOtp() {
    try {
        document.getElementById('loading-message').style.display = 'block';
        document.getElementById('otp-input-section').style.display = 'none';
        
        // 6つのOTP入力ボックスから値を取得
        const otpDigits = [];
        for (let i = 1; i <= 6; i++) {
            const digit = document.getElementById(`otp-digit-${i}`).value;
            otpDigits.push(digit);
            document.getElementById(`otp-digit-${i}`).value = ''; // 入力後にクリア
        }
        const otp = otpDigits.join('');
        
        await pb.collection('users').authWithOTP(
            otpId,
            otp,
        );
        document.getElementById('loading-message').style.display = 'none';

        // ログイン成功
        const email = pb.authStore.model.email;
        await registerUserToDatabase(email);
        hideLoginScreen();
        loadTweets('toukou'); // デフォルトで投稿順に読み込み

        console.log('ログイン成功:', email);

    } catch (error) {
        document.getElementById('loading-message').style.display = 'none';
        document.getElementById('email-input-section').style.display = 'block';
        console.error('OTP検証エラー:', error);
        showDisplayMessage({
            title: 'ログインエラー',
            message: 'OTPの検証に失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
        return;
    }
}



// ページ読み込み時の処理
window.addEventListener('load', async function() {
    
    await checkAuthState();

    const signOutBtn = document.getElementById('signout-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
    }
    
    // OTP入力ボックスの自動フォーカス機能を初期化
    initOtpInputs();
    
    // ログインボタンのイベントリスナー
    const sendLinkBtn = document.getElementById('send-link-btn');
    if (sendLinkBtn) {
        sendLinkBtn.addEventListener('click', sendLoginLink);
    }
    
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', verifyOtp);
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

window.loadTweets = loadTweets; // グローバルに公開