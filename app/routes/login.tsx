import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { auth } from "../firebase";
import { 
  sendSignInLinkToEmail, 
  isSignInWithEmailLink, 
  signInWithEmailLink 
} from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // ページ読み込み時にマジックリンクの確認を行う
  useEffect(() => {
    const handleMagicLinkSignIn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        setLoading(true);
        setStatusMessage("ログインリンクを検証中...");
        
        let savedEmail = window.localStorage.getItem("emailForSignIn");
        
        if (!savedEmail) {
          // 他のデバイスで開いた場合やローカルストレージがクリアされた場合はメールアドレスを再入力してもらう
          setNeedsEmailVerification(true);
          setLoading(false);
          setStatusMessage(null);
          return;
        }

        try {
          await signInWithEmailLink(auth, savedEmail, window.location.href);
          window.localStorage.removeItem("emailForSignIn");
          setStatusMessage("ログインが完了しました。ダッシュボードへ遷移します...");
          setTimeout(() => {
            navigate("/client/dashboard");
          }, 1500);
        } catch (error: any) {
          console.error("サインインエラー:", error);
          setErrorMessage("無効なリンクであるか、有効期限が切れています。もう一度ログインをお試しください。");
          setLoading(false);
        }
      }
    };

    handleMagicLinkSignIn();
  }, [navigate, location]);

  // マジックリンクメールの送信
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const actionCodeSettings = {
      // ログイン後のリダイレクト先URL
      url: window.location.origin + "/login",
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setStatusMessage("ログイン用のリンクをメールで送信しました。受信トレイをご確認ください。");
      setEmail("");
    } catch (error: any) {
      console.error("メール送信エラー:", error);
      setErrorMessage("メールの送信に失敗しました。メールアドレスをご確認の上、再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  // メールアドレス再検証時のサインイン処理
  const handleVerifyEmailAndSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      setStatusMessage("ログインが完了しました。ダッシュボードへ遷移します...");
      setTimeout(() => {
        navigate("/client/dashboard");
      }, 1500);
    } catch (error: any) {
      console.error("サインインエラー:", error);
      setErrorMessage("メールアドレスが一致しないか、リンクが無効です。");
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-color)",
      padding: "2rem"
    }}>
      <div className="neumorphic-panel" style={{
        width: "100%",
        maxWidth: "480px",
        padding: "3.5rem 3rem",
        textAlign: "center"
      }}>
        <h1 className="kinetic-text" style={{ fontSize: "2rem", marginBottom: "1rem", fontWeight: 600 }}>
          DesignBoard
        </h1>
        <p style={{
          color: "var(--text-muted)",
          fontSize: "0.9rem",
          marginBottom: "2.5rem",
          letterSpacing: "0.1em"
        }}>
          制作進行ポータル ログイン
        </p>

        {errorMessage && (
          <div style={{
            padding: "1rem",
            borderRadius: "12px",
            backgroundColor: "rgba(220, 53, 69, 0.1)",
            border: "1px solid rgba(220, 53, 69, 0.2)",
            color: "#dc3545",
            fontSize: "0.85rem",
            marginBottom: "2rem",
            textAlign: "left",
            lineHeight: "1.6"
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div style={{
            padding: "1rem",
            borderRadius: "12px",
            backgroundColor: "rgba(184, 156, 109, 0.1)",
            border: "1px solid rgba(184, 156, 109, 0.2)",
            color: "var(--accent-color)",
            fontSize: "0.85rem",
            marginBottom: "2rem",
            textAlign: "left",
            lineHeight: "1.6"
          }}>
            ℹ️ {statusMessage}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "2rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <div className="spinner" />
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>処理中...</p>
          </div>
        ) : needsEmailVerification ? (
          /* 他のデバイスやシークレットウィンドウでマジックリンクを開いた場合のメールアドレス再入力 */
          <form onSubmit={handleVerifyEmailAndSignIn}>
            <div className="form-group" style={{ textAlign: "left" }}>
              <label htmlFor="email">メールアドレスの確認</label>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: "1.5" }}>
                セキュリティ確保のため、メールリンクを要求した際のメールアドレスを入力してください。
              </p>
              <input
                id="email"
                type="email"
                required
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" style={{ width: "100%", marginTop: "1rem" }}>
              確認してログイン
            </button>
          </form>
        ) : (
          /* 通常のメール送信フォーム */
          <form onSubmit={handleSendLink}>
            <div className="form-group" style={{ textAlign: "left" }}>
              <label htmlFor="email">メールアドレス</label>
              <input
                id="email"
                type="email"
                required
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textAlign: "left",
              marginBottom: "2rem",
              lineHeight: "1.6"
            }}>
              ※ パスワードは不要です。入力されたメールアドレスに、ログイン用のワンタイムリンクをお送りします。
            </p>
            <button type="submit" style={{ width: "100%" }}>
              ログインリンクを送信
            </button>
          </form>
        )}
      </div>

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(184, 156, 109, 0.1);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
