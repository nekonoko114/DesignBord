import type { Route } from "./+types/discovery";
import { FormWizard } from "../../components/FormWizard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Design Hearing Board" },
    { name: "description", content: "Interactive Design Hearing Sheet" },
  ];
}

export default function Discovery() {
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

      <FormWizard />
    </div>
  );
}
