// utils.js - 共通ユーティリティ関数

/**
 * HTMLエスケープ関数（XSS対策）
 * @param {string} text - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * ハッシュタグを装飾する関数
 * @param {string} text - 元のテキスト
 * @returns {string} ハッシュタグが装飾されたHTML文字列
 */
export function formatHashtags(text) {
    const escapedText = escapeHtml(text);
    const hashtagRegex = /#[^\s#]+/g;
    return escapedText.replace(hashtagRegex, (match) => {
        return `<span class="hashtag">${match}</span>`;
    });
}

/**
 * 経過時間を計算する関数
 * @param {string} timestamp - タイムスタンプ
 * @returns {string} 経過時間の文字列
 */
export function getTimeAgo(timestamp) {
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
        return `${diffSeconds}秒前`;
    } else if (diffMinutes < 60) {
        return `${diffMinutes}分前`;
    } else if (diffHours < 24) {
        return `${diffHours}時間前`;
    } else if (diffDays < 30) {
        return `${diffDays}日前`;
    } else if (diffMonths < 12) {
        return `${diffMonths}ヶ月前`;
    } else {
        return `${diffYears}年前`;
    }
}

/**
 * 汎用メッセージ表示関数
 * @param {Object} options - オプション
 * @param {string} options.title - メッセージのタイトル
 * @param {string} options.message - メッセージの本文
 * @param {boolean} options.showCheckbox - チェックボックスを表示するか
 * @param {string} options.storageKey - localStorageのキー
 */
export function showDisplayMessage({
    title = '映像表示について',
    message = '映像に流れるのは<strong>30文字以下の投稿のみ</strong>です',
    showCheckbox = true,
    storageKey = 'dontShowDisplayMessage'
} = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'display-message-overlay';
    
    const messageBox = document.createElement('div');
    messageBox.className = 'display-message-box';
    
    const checkboxHtml = showCheckbox ? `
        <div class="checkbox-container">
            <input type="checkbox" id="dont-show-again" />
            <label for="dont-show-again">このメッセージを今後表示しない</label>
        </div>
    ` : '';
    
    messageBox.innerHTML = `
        <h3>${title}</h3>
        <p>${message}</p>
        ${checkboxHtml}
        <button class="confirm-btn" id="confirm-display-message">OK</button>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    
    // OKボタンのイベントリスナー
    document.getElementById('confirm-display-message').addEventListener('click', () => {
        if (showCheckbox) {
            const checkbox = document.getElementById('dont-show-again');
            if (checkbox.checked) {
                localStorage.setItem(storageKey, 'true');
            }
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
