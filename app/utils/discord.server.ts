export async function sendDiscordNotification(
  env: { DISCORD_WEBHOOK_URL?: string },
  payload: {
    title: string;
    description: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    color?: number;
  }
) {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_WEBHOOK_URL is not defined in environment variables.");
    return;
  }

  const body = {
    embeds: [
      {
        title: payload.title,
        description: payload.description,
        fields: payload.fields || [],
        color: payload.color || 12098669, // #b89c6d (ゴールド)
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error("Discord notification error response:", await response.text());
    }
  } catch (e) {
    console.error("Failed to dispatch Discord notification:", e);
  }
}
