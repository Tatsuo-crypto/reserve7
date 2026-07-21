import { TERMS_VERSION } from '@/lib/legal-versions'

export const metadata = {
  title: '利用規約 | T&J GYM',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-base px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">利用規約</h1>
          <p className="mt-1 text-xs text-text-secondary">最終改定日: {TERMS_VERSION}</p>
        </div>

        <p className="text-sm font-normal leading-relaxed text-text-secondary">
          この利用規約(以下「本規約」)は、[事業者名]（以下「当運営者」）が提供する予約・トレーニング管理サービス「T&J GYM」（以下「本サービス」）の利用条件を定めるものです。
          本サービスをご利用になる方（以下「利用者」）は、本規約に同意のうえ本サービスをご利用ください。
        </p>

        <Section title="第1条（適用）">
          <p>本規約は、利用者と当運営者との間の本サービスの利用に関わる一切の関係に適用されます。</p>
        </Section>

        <Section title="第2条（サービスの内容）">
          <p>本サービスは、予約管理、トレーニング・食事記録の管理、体重・目標管理、通知等の機能を、当運営者が指定するウェブアプリケーションを通じて提供するものです。</p>
        </Section>

        <Section title="第3条（アカウント・アクセストークンの管理）">
          <ul className="list-disc space-y-1 pl-5">
            <li>本サービスの一部機能は、利用者ごとに発行される固有のURL(アクセストークン)によって利用されます。</li>
            <li>利用者は、自己の責任においてアクセストークンを適切に管理し、第三者に開示・共有してはならないものとします。</li>
            <li>アクセストークンの管理不十分により生じた損害について、当運営者は責任を負いません。</li>
          </ul>
        </Section>

        <Section title="第4条（禁止事項）">
          <p>利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>法令または公序良俗に違反する行為</li>
            <li>他の利用者または第三者の権利・利益を侵害する行為</li>
            <li>本サービスの運営を妨害する行為、不正アクセスまたはこれを試みる行為</li>
            <li>虚偽の情報を登録する行為</li>
            <li>その他、当運営者が不適切と判断する行為</li>
          </ul>
        </Section>

        <Section title="第5条（サービスの停止・変更・終了）">
          <p>当運営者は、システムの保守・点検、天災地変その他やむを得ない事由がある場合、利用者への事前の通知なく本サービスの全部または一部の提供を停止・中断・変更・終了することがあります。</p>
        </Section>

        <Section title="第6条（免責事項）">
          <ul className="list-disc space-y-1 pl-5">
            <li>当運営者は、本サービスに事実上または法律上の瑕疵(安全性、信頼性、正確性、完全性、有効性、特定目的への適合性等に関する欠陥、エラーやバグ、権利侵害等を含む)がないことを明示的にも黙示的にも保証しません。</li>
            <li>本サービスで提供される情報(カロリー・PFC計算結果等を含む)は参考情報であり、医学的・栄養学的な助言を代替するものではありません。健康・医療に関する判断は、必ず専門家にご相談ください。</li>
            <li>当運営者は、本サービスに起因して利用者に生じたあらゆる損害について、当運営者の故意または重過失による場合を除き、一切の責任を負いません。</li>
          </ul>
        </Section>

        <Section title="第7条（知的財産権）">
          <p>本サービスに関する著作権・商標権その他の知的財産権は、当運営者または正当な権利を有する第三者に帰属します。</p>
        </Section>

        <Section title="第8条（本規約の変更）">
          <p>当運営者は、必要と判断した場合には、利用者への周知の上、本規約を変更できるものとします。変更後の規約は、本サービス上に表示した時点から効力を生じるものとします。</p>
        </Section>

        <Section title="第9条（準拠法・管轄裁判所）">
          <p>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、[管轄裁判所名]を第一審の専属的合意管轄とします。</p>
        </Section>

        <Section title="お問い合わせ">
          <p>本規約に関するお問い合わせは、下記までご連絡ください。</p>
          <p>[事業者名]　[所在地]　[連絡先メールアドレス]</p>
        </Section>

        <p className="text-xs text-text-secondary">
          ※本規約はテンプレートです。実際の商用提供にあたっては、弁護士等の専門家によるレビューを受けたうえでご利用ください。
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
