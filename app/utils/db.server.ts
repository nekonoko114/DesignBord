// データベースの初期化と初期ユーザーのシード
export async function seedDatabase(db: any) {
  try {
    // ユーザーが存在するか確認
    const usersCountResult = await db
      .prepare("SELECT COUNT(*) as count FROM users")
      .first();
    const count = usersCountResult ? (usersCountResult.count as number) : 0;

    if (count === 0) {
      const testClientId = "test_client_id";
      const testAdminId = "test_admin_id";
      const testProjectId = "test_project_id";
      const testFileImageId = "test_file_image_id";
      const testFileAudioId = "test_file_audio_id";

      // 2日後の面談日時 (UNIXタイムスタンプ秒)
      const scheduledTime = Math.floor(Date.now() / 1000) + 86400 * 2;

      // トランザクション処理 (D1 では batch を使用)
      await db.batch([
        // 初期ユーザー作成
        db
          .prepare(
            "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)",
          )
          .bind(testAdminId, "admin@example.com", "管理者テスト", "admin"),

        db
          .prepare(
            "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)",
          )
          .bind(
            testClientId,
            "client@example.com",
            "クライアントテスト",
            "client",
          ),

        // 初期プロジェクト作成
        db
          .prepare(
            "INSERT INTO projects (id, client_id, title, progress_rate, booking_limit) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            testProjectId,
            testClientId,
            "サンプル株式会社 Webサイト制作プロジェクト",
            35,
            3,
          ),

        // 初期ヒアリング作成 (下書き状態)
        db
          .prepare(
            "INSERT INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            "test_hearing_id",
            testProjectId,
            "draft",
            JSON.stringify({
              companyName: "サンプル株式会社",
              phone: "090-0000-0000",
              deadline: "2026-12-31",
              purpose: "コーポレートサイトの全面リニューアル",
              targetAudience: "30代〜50代のビジネスパーソン",
              hasServer: false,
              hasDomain: false,
            }),
            JSON.stringify({
              pages: "TOP、会社概要、サービス紹介、お問い合わせ",
              designKeywords: ["シンプル", "清潔感", "高級感"],
              themeColors: ["青系", "グレー系"],
              browsers: "Safari, Chrome, Edge",
              assets: "ロゴデータ(AI)あり",
            }),
            0,
          ),

        // テスト用ファイル (画像: カンプ) の追加
        db
          .prepare(
            "INSERT INTO files (id, project_id, file_type, r2_url, uploaded_by) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            testFileImageId,
            testProjectId,
            "image",
            "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=80",
            testAdminId,
          ),

        // テスト用ファイル (音声: ミーティング録音など) の追加
        db
          .prepare(
            "INSERT INTO files (id, project_id, file_type, r2_url, uploaded_by) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            testFileAudioId,
            testProjectId,
            "audio",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            testClientId,
          ),

        // テスト用アノテーション (コメント) の追加
        db
          .prepare(
            "INSERT INTO annotations (id, file_id, user_id, pos_x, pos_y, comment) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            "test_annotation_1",
            testFileImageId,
            testClientId,
            45.2,
            32.1,
            "メインビジュアルの画像をもう少し明るいものに変更できますか？",
          ),

        db
          .prepare(
            "INSERT INTO annotations (id, file_id, user_id, pos_x, pos_y, comment) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            "test_annotation_2",
            testFileImageId,
            testAdminId,
            60.8,
            55.3,
            "承知いたしました。明るめの画像候補をご提案します。",
          ),

        // テスト用予約の追加
        db
          .prepare(
            "INSERT INTO bookings (id, project_id, scheduled_at, status) VALUES (?, ?, ?, ?)",
          )
          .bind("test_booking_1", testProjectId, scheduledTime, "reserved"),
      ]);

      console.log("Database seeded successfully.");
    }
  } catch (e) {
    console.error("Failed to seed database:", e);
  }
}
