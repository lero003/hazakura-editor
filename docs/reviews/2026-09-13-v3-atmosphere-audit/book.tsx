// Visual review only; real component, sample data, no native I/O.
import React from "react";
import {createRoot} from "react-dom/client";
import {BookScopePanel} from "../../../src/components/workspace/BookScopePanel";
import "../../../src/styles/index.css";
document.documentElement.dataset.theme="light";
const chapters=["はじめに","朝の余白","散歩の途中で","机と窓辺","雨の日の記録","おわりに"].map((n,i)=>({name:n+".md",relativePath:`${i+1}_${n}.md`,path:`/workspace/${i+1}_${n}.md`}));
const nodes=chapters.map(c=>({kind:"document" as const,relativePath:c.relativePath,children:[]}));
const tree={name:"散文集",path:"/workspace",kind:"directory" as const,children_loaded:true,children_truncated:false,children:[]};
createRoot(document.getElementById("root")!).render(<div style={{width:280,height:"100vh",background:"var(--nav-surface)"}}><BookScopePanel activePath={chapters[1].path} chapterRelativePaths={chapters.map(c=>c.relativePath)} chapters={chapters} nodes={nodes} menuLanguage="ja" workspaceRootPath="/workspace" workspaceTree={tree} unavailable={[]} resolving={false} onCommit={()=>{}} onLoadDirectory={async()=>{}} onOpenChapter={()=>{}} onRevalidate={()=>{}} onReadBook={()=>{}} /></div>);
