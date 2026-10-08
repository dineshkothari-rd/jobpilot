import { ArrowUpRight, BriefcaseBusiness, Check, FileText, Sparkles } from "lucide-react";

// Decorative artwork only: no simulated match scores, offers or user achievements.
export function CareerScene() {
  return <div className="career-scene" aria-hidden="true">
    <div className="scene-orbit" />
    <div className="scene-sphere" />
    <div className="scene-document">
      <span className="scene-document-icon"><FileText size={24} /></span>
      <span className="scene-line scene-line-title" /><span className="scene-line" /><span className="scene-line scene-line-short" />
      <div className="scene-document-rule" />
      <span className="scene-line" /><span className="scene-line" /><span className="scene-line scene-line-short" />
      <span className="scene-tags"><i /><i /><i /></span>
    </div>
    <div className="scene-opportunity"><span><BriefcaseBusiness size={20} /></span><div><b>Your next chapter</b><small>Discover the possibilities</small></div><ArrowUpRight size={19} /></div>
    <div className="scene-check"><Check size={25} strokeWidth={3} /></div>
    <Sparkles className="scene-spark" size={26} />
  </div>;
}
