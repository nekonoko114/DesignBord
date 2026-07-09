import { useState, useEffect } from "react";
import { useLoaderData, redirect, useActionData, Link } from "react-router";
import type { Route } from "./+types/discovery";
import { FormWizard } from "../../components/FormWizard";
import { requireUserRole } from "../../utils/auth.server";
import { sendDiscordNotification } from "../../utils/discord.server";

export async function loader(args: Route.LoaderArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  let existingAnswer = null;
  let termsAccepted = false;
  let hearingStatus = "draft";

  try {
    const project = await db.prepare("SELECT id FROM projects WHERE client_id = ?").bind(userId).first();
    if (project) {
      const hearing = await db.prepare("SELECT * FROM hearings WHERE project_id = ?").bind(project.id).first();
      if (hearing) {
        const overview = hearing.overview_data ? JSON.parse(hearing.overview_data as string) : {};
        const content = hearing.content_data ? JSON.parse(hearing.content_data as string) : {};
        const rawAnswer = { ...overview, ...content };
        
        // Map snake_case or legacy db fields to camelCase form fields
        const keyMap: { [key: string]: string } = {
          company_name: 'companyName',
          contact_person: 'companyName',
          phone: 'phone',
          address: 'address',
          deadline: 'deadline',
          delivery_format: 'deliveryFormat',
          has_server: 'hasServer',
          has_domain: 'hasDomain',
          existing_domain: 'existingDomain',
          ftp_details: 'ftpDetails',
          site_type: 'siteType',
          background: 'background',
          purpose: 'purpose',
          must_convey: 'mustConvey',
          target_audience: 'targetAudience',
          brand_personality: 'brandPersonality',
          desired_emotion: 'desiredEmotion',
          ng_design: 'ngDesign',
          design_keywords: 'designKeywords',
          theme_colors: 'themeColors',
          competitors: 'competitors',
          pages: 'pages',
          features: 'features',
          sns_link: 'snsLink',
          responsive: 'responsive',
          browsers: 'browsers',
          assets: 'assets'
        };

        const mappedAnswer: any = {};
        for (const key in rawAnswer) {
          const mappedKey = keyMap[key] || key;
          mappedAnswer[mappedKey] = rawAnswer[key];
        }

        // Normalize radio boolean values from DB
        const normalizeBoolean = (val: any): boolean | null => {
          if (val === 1 || val === '1' || val === true) return true;
          if (val === 0 || val === '0' || val === false) return false;
          return null;
        };

        mappedAnswer.hasServer = normalizeBoolean(mappedAnswer.hasServer);
        mappedAnswer.hasDomain = normalizeBoolean(mappedAnswer.hasDomain);

        // Support string parsing for array fields if saved as strings
        if (typeof mappedAnswer.designKeywords === 'string') {
          try { mappedAnswer.designKeywords = JSON.parse(mappedAnswer.designKeywords); } catch { mappedAnswer.designKeywords = []; }
        }
        if (typeof mappedAnswer.themeColors === 'string') {
          try { mappedAnswer.themeColors = JSON.parse(mappedAnswer.themeColors); } catch { mappedAnswer.themeColors = []; }
        }

        existingAnswer = mappedAnswer;
        termsAccepted = Boolean(hearing.terms_accepted);
        hearingStatus = hearing.status;
      }
    }
  } catch (e) {
    console.error("Failed to load existing discovery answers:", e);
  }

  return {
    existingAnswer,
    termsAccepted,
    hearingStatus,
  };
}

export async function action(args: Route.ActionArgs) {
  const { context, request } = args;
  const { userId } = await requireUserRole(args, ["client"]);
  const db = (context as any).cloudflare.env.DB;

  const formData = await request.formData();
  const actionType = formData.get("actionType") as "draft" | "submit";
  const dataString = formData.get("data") as string;
  const termsAcceptedVal = formData.get("termsAccepted") === "true" ? 1 : 0;

  if (!dataString) {
    return { error: "データが空です。" };
  }

  let parsedData: any = {};
  try {
    parsedData = JSON.parse(dataString);
  } catch (e) {
    return { error: "データの解析に失敗しました。" };
  }

  // Split form data into overview_data and content_data based on step categories
  const overviewKeys = [
    "companyName", "phone", "address", "deadline", "deliveryFormat", 
    "hasServer", "hasDomain", "existingDomain", "ftpDetails", 
    "siteType", "background", "purpose", "mustConvey", 
    "targetAudience", "brandPersonality", "desiredEmotion", "ngDesign"
  ];

  const overviewData: any = {};
  const contentData: any = {};

  for (const key in parsedData) {
    if (overviewKeys.includes(key)) {
      overviewData[key] = parsedData[key];
    } else {
      contentData[key] = parsedData[key];
    }
  }

  try {
    const project = await db.prepare("SELECT id, title FROM projects WHERE client_id = ?").bind(userId).first();
    if (!project) {
      return { error: "プロジェクトが見つかりません。" };
    }

    const hearing = await db.prepare("SELECT id FROM hearings WHERE project_id = ?").bind(project.id).first();
    const hearingId = hearing ? hearing.id : crypto.randomUUID();
    const status = actionType === "submit" ? "submitted" : "draft";

    // 1. Save to hearings table
    await db.prepare(
      "INSERT OR REPLACE INTO hearings (id, project_id, status, overview_data, content_data, terms_accepted, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))"
    ).bind(
      hearingId,
      project.id,
      status,
      JSON.stringify(overviewData),
      JSON.stringify(contentData),
      termsAcceptedVal
    ).run();

    // 2. Update project last activity timestamp
    await db.prepare(
      "UPDATE projects SET last_activity_at = strftime('%s', 'now') WHERE id = ?"
    ).bind(project.id).run();

    // 3. Dispatch Discord webhook notification on final submission
    if (status === "submitted") {
      const env = (context as any).cloudflare.env;
      await sendDiscordNotification(env, {
        title: "📄 ヒアリングシート提出のお知らせ",
        description: `クライアント様よりヒアリングシートが最終提出されました。`,
        fields: [
          { name: "プロジェクト名", value: project.title as string, inline: true },
          { name: "会社名", value: parsedData.companyName || "未入力", inline: true },
          { name: "制作目的", value: parsedData.purpose || "未入力", inline: false },
          { name: "希望納期", value: parsedData.deadline || "未設定", inline: true },
        ],
        color: 5025616, // #4CAF50 (緑)
      });
    }

    return { success: true };
  } catch (e) {
    console.error("Discovery save error:", e);
    return { error: "保存処理中にエラーが発生しました。" };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Design Board - ヒアリング" },
    { name: "description", content: "Interactive Design Hearing Sheet" },
  ];
}

export default function Discovery() {
  const { existingAnswer, termsAccepted, hearingStatus } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: boolean }>();
  const titleText = "デザインヒアリング";
  
  const [isEditing, setIsEditing] = useState(false);

  // 送信が成功したら完了画面（非編集モード）に戻す
  useEffect(() => {
    if (actionData?.success) {
      setIsEditing(false);
    }
  }, [actionData]);

  // ローダーのデータ（hearingStatus 等）が変わったときも状態をリセットする
  useEffect(() => {
    setIsEditing(false);
  }, [hearingStatus]);
  
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative', zIndex: 1 }}>
        <h1 
          className="kinetic-text"
          style={{ 
            fontSize: '1.8rem', 
            fontWeight: 500, 
            letterSpacing: '0.05em',
            margin: '0 auto',
          }}
        >
          {titleText.split('').map((char, index) => (
            <span 
              key={index} 
              className={char === ' ' ? '' : 'kinetic-char'} 
              style={{ 
                '--char-index': index,
                whiteSpace: 'pre'
              } as React.CSSProperties}
            >
              {char}
            </span>
          ))}
        </h1>
        <p className="font-gothic" style={{ opacity: 0.6, marginTop: '0.8rem', letterSpacing: '0.15em', fontSize: '0.8rem' }}>
          理想のウェブサイトに近づけるためのオンラインヒアリング
        </p>
      </header>

      {hearingStatus === "submitted" && !isEditing ? (
        <div className="neumorphic-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 className="font-mincho" style={{ fontSize: '1.8rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
            ヒアリングシート提出完了
          </h2>
          <p className="font-gothic" style={{ opacity: 0.8, lineHeight: '1.8', marginBottom: '2rem' }}>
            ヒアリングシートのご提出ありがとうございました。<br />
            ご回答内容に基づき、制作スタッフがデザイン作成を開始いたします。<br />
            内容の確認や変更がある場合は、担当ディレクターまでご連絡ください。
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2.5rem' }}>
            <Link 
              to="/client/dashboard" 
              style={{ 
                textDecoration: 'none',
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                padding: '0.8rem 2.2rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'var(--font-gothic)',
                boxShadow: '0 4px 15px rgba(184, 156, 109, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              ダッシュボードへ戻る
            </Link>
            <button 
              onClick={() => setIsEditing(true)}
              style={{ 
                background: 'transparent',
                border: '1px solid rgba(184, 156, 109, 0.4)',
                color: 'var(--accent-color)',
                padding: '0.8rem 2.2rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 500,
                fontFamily: 'var(--font-gothic)',
                cursor: 'pointer',
                boxShadow: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                minWidth: 'auto',
                minHeight: 'auto'
              }}
            >
              回答内容を再編集する
            </button>
          </div>
        </div>
      ) : (
        <FormWizard 
          initialData={existingAnswer} 
          initialTermsAccepted={termsAccepted} 
          actionError={actionData?.error}
        />
      )}
    </div>
  );
}
