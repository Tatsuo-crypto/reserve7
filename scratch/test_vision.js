const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function diagnose() {
  try {
    console.log('--- 診断開始 ---');
    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    console.log('設定されている Project ID:', key.project_id);
    console.log('設定されている Client Email:', key.client_email);

    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    console.log('認証済み Project ID:', projectId);

    const vision = google.vision({ version: 'v1', auth });
    
    console.log('テストリクエスト送信中...');
    // 空の画像データで OCR を試みる（課金状態をチェックするため）
    await vision.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }, // 1x1 透明画像
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      },
    });
    
    console.log('✅ 成功！解析機能は正常に動作しています。');
  } catch (error) {
    console.error('❌ エラー発生');
    if (error.response && error.response.data) {
      console.error('Google からの詳細エラー:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('エラーメッセージ:', error.message);
    }
  }
}

diagnose();
