self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'T&J GYM'
  const options = {
    body: data.body || '',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

/**
 * AX-4: 通知をタップしたら、その通知に対応する画面を開く。
 *
 * 以前は `client.url.includes(url)` で既存タブを探して focus() するだけだったため、
 *   - アプリが別の画面(例: ホーム)で開いたままだと、focusするだけで画面が変わらない
 *   - 逆にクエリ違い(?view=notifications など)は一致せず、毎回新しいタブが開く
 * という2つの問題があった。
 * 「同じ会員ページが開いていれば navigate() で目的の画面へ移動し、無ければ新規に開く」
 * という形に変更する。
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  const targetUrl = new URL(url, self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        let clientUrl
        try {
          clientUrl = new URL(client.url)
        } catch (e) {
          continue
        }

        // 同じページ(会員ページはトークンを含むパスなので、パスが同じなら同じ会員)が
        // 既に開いていれば、そのタブを目的のURLへ移動させてから前面に出す
        if (clientUrl.pathname === targetUrl.pathname) {
          if ('navigate' in client) {
            return client.navigate(targetUrl.href).then((navigated) => (navigated || client).focus())
          }
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href)
      }
    })
  )
})
