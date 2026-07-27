-- AO-2: 配信履歴に「誰に送ったか」の表示用ラベルを追加
-- (例: "全員" / "オンラインレッスン: 朝ヨガ" / "個別選択(3名)")
alter table public.broadcast_messages
  add column if not exists target_label text;
