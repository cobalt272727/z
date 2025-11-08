// HTMLエスケープ関数
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 時間表示関数
function getTimeAgo(timestamp) {
    const now = new Date();
    const tweetTime = new Date(timestamp);
    const diffMs = now - tweetTime;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return `${diffSec}秒前`;
    } else if (diffMin < 60) {
        return `${diffMin}分前`;
    } else if (diffHour < 24) {
        return `${diffHour}時間前`;
    } else {
        return `${diffDay}日前`;
    }
}

// マイページを開く
async function openMypage() {
    try {
        const isLoggedIn = await window.magic.user.isLoggedIn();
        
        if (!isLoggedIn) {
            alert("ログインしていません");
            return;
        }

        
        const metadata = await window.magic.user.getInfo();
        const email = metadata.email;
        
        // ユーザー情報を取得
        const userResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/register-user`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${await window.magic.user.getIdToken()}`
            },
            body: JSON.stringify({})
        });
        
        const userResult = await userResponse.json();
        let icon = 1;
        let name = email.split('@')[0];
        
        if (userResult.status === "success" || userResult.status === "already_exists") {
            // ユーザーリストから情報を取得
            const didToken = await window.magic.user.getIdToken();
            const tweetsResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/my-tweets`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${didToken}`
                }
            });
            const tweetsResult = await tweetsResponse.json();
            
            if (tweetsResult.tweets.length > 0) {
                icon = tweetsResult.tweets[0].icon;
                name = tweetsResult.tweets[0].name;
            }
        }
        
        // マイページのユーザー情報を更新
        document.getElementById('mypage-icon').src = `svg/kkrn_icon_user_${icon}.svg`;
        document.getElementById('mypage-username').textContent = name;
        
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
        
        // 自分のツイートを読み込む
        await loadMyTweets();
        
    } catch (error) {
        console.error('マイページオープンエラー:', error);
        alert('マイページの表示に失敗しました');
    }
}

// マイページを閉じる
function closeMypage() {
    loadTweets(); // ツイート一覧を再読み込み
    document.getElementById('mypage').style.display = 'none';
    document.getElementById('tweet').style.display = 'block';
    document.getElementById('tweetreload').style.display = 'flex';
    document.getElementById('newtweet').style.display = 'block';
    const header = document.getElementById('header');
    header.style.display = 'flex';
    // ヘッダーのtransformを元に戻す
    header.style.transform = 'translateY(0)';
    // bodyのpadding-topを元に戻す
    document.body.style.paddingTop = '52px';
}

// 自分のツイートを読み込む
async function loadMyTweets() {
    try {
        const didToken = await window.magic.user.getIdToken();
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/my-tweets`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${didToken}`
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
                            <p class="content">${escapeHtml(tweet.message)}</p>
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
        const didToken = await window.magic.user.getIdToken();
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/iine-users/${tweetId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${didToken}`
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
        alert('いいねユーザーの取得に失敗しました');
    }
}

// ツイートを削除
async function deleteTweet(tweetId) {
    if (!confirm('本当にこのツイートを削除しますか？')) {
        return;
    }
    
    try {
        const didToken = await window.magic.user.getIdToken();
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/tweets/${tweetId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${didToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            alert('ツイートを削除しました');
            await loadMyTweets(); // 再読み込み
        } else {
            alert('削除に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除中にエラーが発生しました');
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
