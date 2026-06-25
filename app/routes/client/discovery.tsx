import { useLoaderData, redirect } from "react-router";
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
        existingAnswer = { ...overview, ...content };
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
      await sendDiscordNotification({
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
  const titleText = "デザインヒアリング";
  
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: '4rem', position: 'relative', zIndex: 1 }}>
        <h1 
          className="kinetic-text"
          style={{ 
            fontSize: '2.8rem', 
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
        <p className="font-gothic" style={{ opacity: 0.6, marginTop: '1.5rem', letterSpacing: '0.15em', fontSize: '0.9rem' }}>
          理想のウェブサイトに近づけるためのオンラインヒアリング
        </p>
      </header>

      {hearingStatus === "submitted" ? (
        <div className="neumorphic-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 className="font-mincho" style={{ fontSize: '1.8rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
            ヒアリングシート提出完了
          </h2>
          <p className="font-gothic" style={{ opacity: 0.8, lineHeight: '1.8', marginBottom: '2rem' }}>
            ヒアリングシートのご提出ありがとうございました。<br />
            ご回答内容に基づき、制作スタッフがデザイン作成を開始いたします。<br />
            内容の確認や変更がある場合は、担当ディレクターまでご連絡ください。
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a href="/client" className="neu-btn" style={{ textDecoration: 'none' }}>
              ダッシュボードへ戻る
            </a>
          </div>
        </div>
      ) : (
        <FormWizard initialData={existingAnswer} initialTermsAccepted={termsAccepted} />
      )}
    </div>
  );
}
