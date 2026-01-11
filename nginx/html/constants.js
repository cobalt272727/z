// constants.js - フロントエンド用定数定義

export const CONSTANTS = {
    // 文字数制限
    TWEET_MAX_LENGTH: 100,
    DISPLAY_MESSAGE_MAX_LENGTH: 30,
    TWEET_WARNING_LENGTH: 90,
    
    // ローディング設定
    LOADING_DELAY: 100,
    
    // アニメーション設定
    TRANSITION_DURATION: 300,
    
    // その他
    DEFAULT_SORT: 'toukou',
    
    // ローカルストレージキー
    STORAGE_KEYS: {
        DONT_SHOW_MESSAGE: 'dontShowDisplayMessage'
    },
    
    // エラーメッセージ
    ERRORS: {
        AUTH_REQUIRED: 'ログインが必要です',
        NETWORK_ERROR: '通信エラーが発生しました',
        GENERAL_ERROR: 'エラーが発生しました'
    }
};
