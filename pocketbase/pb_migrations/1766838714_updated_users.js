/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "otp": {
      "emailTemplate": {
        "body": "<!DOCTYPE html>\n    <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>{APP_NAME}</title>\n        <style>\n            .box{\n                font-size: 24px;\n                font-weight: bold;\n                margin: 16px 0;\n                background-color: #e4e4e4;\n                border: 1px solid #d1d1d1;\n                border-radius: 10px;\n                text-align: center;\n            }\n            span{\n                display: inline-block;\n                padding: 8px 16px;\n                letter-spacing: 8px;\n\n            }\n        </style>\n    </head>\n    <body>\n        <p>あなたのログインコードを発行しました。</p>\n\n        <p>ログインコード:</p>\n        <div class=\"box\" onclick=\"copy()\"><span>{OTP}</span></div>\n        <p>このコードは<strong>3分間</strong>有効です。</p>\n        <p><i>本メールに心当たりがなければ、無視していただいて構いません。</i></p>\n        <p>{APP_NAME}</p>\n<script>\n    function copy(){\n        const codeBox = document.querySelector('.box span');\n        const code = codeBox.textContent;\n        navigator.clipboard.writeText(code).then(() => {\n        }).catch(err => {\n        });\n    }\n</script>\n    </body>\n</html>"
      }
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  // update collection data
  unmarshal({
    "otp": {
      "emailTemplate": {
        "body": "<!DOCTYPE html>\n    <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title></title>\n        <style>\n            .box{\n                font-size: 24px;\n                font-weight: bold;\n                margin: 16px 0;\n                background-color: #e4e4e4;\n                border: 1px solid #d1d1d1;\n                border-radius: 10px;\n                text-align: center;\n            }\n            span{\n                display: inline-block;\n                padding: 8px 16px;\n                letter-spacing: 8px;\n\n            }\n        </style>\n    </head>\n    <body>\n        <p>あなたのログインコードを発行しました。</p>\n\n        <p>ログインコード:</p>\n        <div class=\"box\"><span>{OTP}</span></div>\n        <p>このコードは3分間有効です。</p>\n        <p><i>本メールに心当たりがなければ、無視していただいて構いません。</i></p>\n        <p>Z-Login-System</p>\n<script src=\"\"></script>\n    </body>\n</html>"
      }
    }
  }, collection)

  return app.save(collection)
})
