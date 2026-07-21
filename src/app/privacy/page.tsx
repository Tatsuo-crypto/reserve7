import { PRIVACY_VERSION } from '@/lib/legal-versions'

export const metadata = {
  title: 'プライバシーポリシー | T&J GYM',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-base px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">プライバシーポリシー</h1>
          <p className="mt-1 text-xs text-text-secondary">最終改定日: {PRIVACY_VERSION}</p>
        </div>

        <p className="text-sm font-normal leading-relaxed text-text-secondary">
          [事業者名]（以下「当運営者」）は、予約・トレーニング管理サービス「T&J GYM」（以下「本サービス」）における利用者の個人情報を、個人情報の保護に関する法律その他関係法令を遵守し、以下の方針に基づき取り扱います。
        </p>

        <Section title="1. 取得する情報">
          <p>本サービスは、利用者に関する以下の情報を取得します。</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>氏名、メールアドレス等の登録情報</li>
            <li>予約履歴、来店回数等の利用状況</li>
            <li>体重、カロリー・PFC(タンパク質・脂質・炭水化物)、歩数、水分・睡眠等の記録(利用者本人が自主的に記録するものであり、医療機関の診療を通じて取得するものではありません)</li>
            <li>食事の写真(記録・解析目的でアップロードされた場合)</li>
            <li>本サービスの利用状況に関するログ情報</li>
          </ul>
        </Section>

        <Section title="2. 利用目的">
          <ul className="list-disc space-y-1 pl-5">
            <li>予約の管理・確認・通知のため</li>
            <li>トレーニング・食事・体重等の記録の管理、目標達成状況の可視化のため</li>
            <li>食事写真からのカロリー・栄養素の自動解析のため</li>
            <li>本サービスに関するお知らせ・通知の送付のため</li>
            <li>本サービスの維持・改善、不正利用の防止のため</li>
          </ul>
        </Section>

        <Section title="3. 第三者提供・業務委託">
          <p>当運営者は、以下の外部サービスに情報の取り扱いを委託することがあります。委託先とは適切な契約を締結し、必要な範囲でのみ情報を提供します。</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase（データベース・認証基盤のホスティング）</li>
            <li>Google Calendar API（予約情報のカレンダー連携。氏名・連絡先・予約日時等が連携されます）</li>
            <li>Google Gemini API 等の画像解析サービス（食事写真からのカロリー・栄養素解析）</li>
            <li>Vercel（アプリケーションのホスティング）</li>
          </ul>
          <p>上記のほか、法令に基づく場合を除き、利用者の同意なく第三者に個人情報を提供することはありません。</p>
        </Section>

        <Section title="4. 安全管理措置">
          <p>当運営者は、取得した個人情報の漏えい、滅失またはき損の防止その他の安全管理のために必要かつ適切な措置を講じます。</p>
        </Section>

        <Section title="5. 開示・訂正・利用停止・削除等の請求">
          <p>利用者は、当運営者に対し、自己の個人情報の開示、訂正、利用停止、削除等を請求することができます。請求は本サービスの設定画面、または下記お問い合わせ先までご連絡ください。合理的な期間内に対応いたします。</p>
        </Section>

        <Section title="6. Cookie等の利用">
          <p>本サービスは、ログイン状態の維持やプッシュ通知の配信のために、Cookieおよびブラウザの通知購読機能を利用することがあります。</p>
        </Section>

        <Section title="7. 本ポリシーの改定">
          <p>当運営者は、必要に応じて本ポリシーを改定することがあります。重要な変更を行う場合は、本サービス上でお知らせします。</p>
        </Section>

        <Section title="お問い合わせ窓口">
          <p>[事業者名]　[所在地]　[連絡先メールアドレス]</p>
        </Section>

        <p className="text-xs text-text-secondary">
          ※本ポリシーはテンプレートです。実際の商用提供にあたっては、弁護士等の専門家によるレビューを受けたうえでご利用ください。
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      <div className="space-y-2 text-sm font-normal leading-relaxed text-text-secondary">{children}</div>
    </section>
  )
}
