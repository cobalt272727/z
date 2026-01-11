import PocketBase from "./pb.js";
import { escapeHtml, formatHashtags, getTimeAgo, showDisplayMessage } from './utils.js';

const pb = new PocketBase(window.APP_CONFIG.POCKETBASE_URL);

// マイページを開く
async function openMypage() {
    try {
        const isLoggedIn = pb.authStore.isValid;
        
        if (!isLoggedIn) {
            showDisplayMessage({
                title: 'ログインが必要です',
                message: 'マイページを表示するにはログインが必要です。<br>ログイン後、再度お試しください。',
                showCheckbox: false
            });
            return;
        }
                // マイページを表示
        document.getElementById('mypage').style.display = 'block';
        document.getElementById('tweet').style.display = 'none';
        document.getElementById('tweetreload').style.display = 'none';
        document.getElementById('newtweet').style.display = 'none';
        const header = document.getElementById('header');
        header.style.display = 'none';
        // ヘッダーのtransformをリセット
        header.style.transform = 'translateY(0)';
        // bodyのpadding-topをリセット（ヘッダー分のスペースを削除）
        document.body.style.paddingTop = '0';
        
        // マイページのスクロール位置を一番上にリセット
        document.getElementById('mypage').scrollTop = 0;

        
        const metadata = await pb.collection('users').getOne(pb.authStore.model.id);
        const email = metadata.email;
        
        let name = email.split('@')[0];
        
        
        // マイページのユーザー情報を更新
        document.getElementById('mypage-username').textContent = name;
        
        
        // 自分のツイートを読み込む
        await loadMyTweets();
        
    } catch (error) {
        console.error('マイページオープンエラー:', error);
        showDisplayMessage({
            title: 'エラーが発生しました',
            message: 'マイページの表示に失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
    }
}

// マイページを閉じる
function closeMypage() {

    document.getElementById('mypage').style.display = 'none';
    document.getElementById('tweet').style.display = 'block';
    document.getElementById('tweetreload').style.display = 'flex';
    document.getElementById('newtweet').style.display = 'block';
    const header = document.getElementById('header');
    header.style.display = 'block';
    // ヘッダーのtransformを元に戻す
    header.style.transform = 'translateY(0)';
    // bodyのpadding-topを元に戻す
    document.body.style.paddingTop = '98px';
    loadTweets(); // ツイート一覧を再読み込み
}

// 自分のツイートを読み込む
async function loadMyTweets() {
    // ローディング表示
    const tweetContainer = document.getElementById('mypage-tweets');
    tweetContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="spinner" style="margin: 0 auto 20px;"></div><p style="color: #666;">読み込み中...</p></div>';
    
    try {

        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/my-tweets`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${pb.authStore.token}`
            }
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            const tweetContainer = document.getElementById('mypage-tweets');
            tweetContainer.innerHTML = '';
            
            if (result.tweets.length === 0) {
                tweetContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">まだツイートがありません</p>';
                return;
            }
            
            // 各ツイートを表示
            result.tweets.forEach(tweet => {
                const tweetBox = document.createElement('div');
                tweetBox.className = `tweetbox id-${tweet.id}`;
                
                const timeAgo = getTimeAgo(tweet.time);
                
                // いいね数が0より多い場合のみ、いいね表示エリアを追加
                const iineSection = tweet.iine > 0 ? `
                    <div class="iinelist" data-tweet-id="${tweet.id}">
                        <p class="iine-count" onclick="toggleIineUsers(${tweet.id})">${tweet.iine}件のいいねを表示</p>
                        <div class="iine-users" id="iine-users-${tweet.id}"></div>
                    </div>
                ` : '';
                
                tweetBox.innerHTML = `
                    <img class="tweeticon" src="svg/kkrn_icon_user_${tweet.icon}.svg" alt="">
                    <div class="tweetright">
                        <div class="rtop">
                            <p class="username">${escapeHtml(tweet.name)}</p>
                            <p class="timestamp">${timeAgo}</p>
                        </div>
                        <div class="rbottom">
                            <p class="content">${formatHashtags(tweet.message)}</p>
                            <div class="delete" data-tweet-id="${tweet.id}">
                                <img src="svg/dustbox.svg" class="delete-icon" alt="">
                                <p class="delete-message">削除</p>
                            </div>
                        </div>
                        ${iineSection}
                    </div>
                `;
                
                tweetContainer.appendChild(tweetBox);
            });
            
            console.log('自分のツイートを読み込みました:', result.tweets.length + '件');

        } else {
            console.error('ツイート取得エラー:', result);
        }
    } catch (error) {
        console.error('自分のツイート取得APIエラー:', error);
    }
}

// いいねユーザー一覧の表示/非表示を切り替え
async function toggleIineUsers(tweetId) {
    const usersContainer = document.getElementById(`iine-users-${tweetId}`);
    
    if (usersContainer.classList.contains('show')) {
        usersContainer.classList.remove('show');
        return;
    }
    
    try {
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/iine-users/${tweetId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${pb.authStore.token}`
            }
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            usersContainer.innerHTML = '';
            
            if (result.users.length === 0) {
                usersContainer.innerHTML = '<p style="text-align: center; color: #999; margin: 5px 0;">いいねしたユーザーはいません</p>';
            } else {
                result.users.forEach(user => {
                    const userItem = document.createElement('div');
                    userItem.className = 'iine-user-item';
                    userItem.innerHTML = `
                        <img class="iine-user-icon" src="svg/kkrn_icon_user_${user.icon}.svg" alt="">
                        <p class="iine-user-name">${escapeHtml(user.name)}</p>
                    `;
                    usersContainer.appendChild(userItem);
                });
            }
            
            usersContainer.classList.add('show');
        }
    } catch (error) {
        console.error('いいねユーザー取得エラー:', error);
        showDisplayMessage({
            title: 'エラーが発生しました',
            message: 'いいねユーザーの取得に失敗しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
    }
}

// ツイートを削除
async function deleteTweet(tweetId) {
    if (!confirm('本当にこのツイートを削除しますか？')) {
        return;
    }
    
    try {
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/tweets/${tweetId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${pb.authStore.token}`
            }
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            showDisplayMessage({
                title: 'ツイートを削除しました',
                message: 'ツイートの削除が完了しました。',
                showCheckbox: false
            });
            await loadMyTweets(); // 再読み込み
        } else {
            showDisplayMessage({
                title: '削除に失敗しました',
                message: result.message,
                showCheckbox: false
            });
        }
    } catch (error) {
        console.error('削除エラー:', error);
        showDisplayMessage({
            title: '削除エラー',
            message: '削除中にエラーが発生しました。<br>時間をおいて再度お試しください。',
            showCheckbox: false
        });
    }
}

// 削除ボタンのイベントリスナー
document.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".delete");
    
    if (deleteBtn) {
        const tweetId = deleteBtn.getAttribute("data-tweet-id");
        
        if (tweetId) {
            await deleteTweet(tweetId);
        }
    }
});

// マイページアイコンのクリックイベント
document.getElementById('gomypage').addEventListener('click', openMypage);
document.getElementById('close-mypage').addEventListener('click', closeMypage);
window.toggleIineUsers = toggleIineUsers;