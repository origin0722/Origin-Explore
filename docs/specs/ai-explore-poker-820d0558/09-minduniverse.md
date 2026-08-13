# 09 — MindUniverse（全屏 3D 思维宇宙）

文件: `src/components/sites/ai-explore-poker-820d0558/mind-universe.tsx`（"use client"，导出 `MindUniverse`）
技术栈: three + @react-three/fiber + @react-three/drei（已装）
入口: MindscapePanel "进入 3D 宇宙" → useApp().setUniverseOpen(true); Shell 渲染
```
{universeOpen && <MindUniverse onClose={() => setUniverseOpen(false)}/>}
```

## 结构（全屏 overlay）
```
<div className="fixed inset-0 z-[80] bg-[#05080a]">
  <Canvas camera={{ position: [0, 2.2, 7], fov: 55 }}>
    <color attach="background" args={["#05080a"]} />
    <ambientLight intensity={0.4} />
    <pointLight position={[4, 6, 4]} intensity={30} color="#13e425" />   // 品牌绿氛围光
    <PointStars />                // 粒子背景: <points> 随机 800 点, 缓慢旋转
    <NodeGroup nodes={validated} />
    <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.6} minDistance={3} maxDistance={16} />
  </Canvas>
  ├─ 左上: 标题 <h2 className="text-lg font-bold text-white">思维宇宙</h2> + 节点数（text-xs text-white/50）
  ├─ 右上: 关闭按钮（X, w-10 h-10 rounded-full bg-white/10 hover:bg-white/20）→ onClose
  └─ 节点详情浮层（选中节点时, 右下卡片）: bg-[#101614]/90 border border-brand/30 rounded-2xl p-4 w-[320px] backdrop-blur
      主题（font-semibold text-white）+ 内容（text-sm text-white/70 line-clamp-6）+ 时间 + [删除] + [关闭]
</div>
```

## NodeGroup（节点 + 连线）
```
nodes = useApp().thoughtNodes.filter(n => n.status === "validated")   // 或 props 传入, 二选一: 用 useApp 简单
positions: 斐波那契球面分布（n 个节点均匀分布在半径 2.6 球面上, 公式: y = 1 - (i/(n-1))*2; r = sqrt(1-y²);
           theta = i * 2.39996（黄金角）; 确定性, 不用随机）
每个节点:
  <mesh position onClick={(e)=>{e.stopPropagation(); setSelected(node)}} scale={进入动画: 挂载时 0→1 弹性}>
    <sphereGeometry args={[0.16, 24, 24]} />
    <meshStandardMaterial color={categoryColor(node.category)} emissive={categoryColor} emissiveIntensity={1.6} />
  </mesh>
  + 光晕: <sprite scale={[0.55,0.55,1]}><spriteMaterial 径向渐变贴图(程序生成 canvas 圆点) transparent/></sprite>
连线（n≥2）: 每个节点连最近 2-3 个邻居（按距离贪心, 去重）→ <line>（THREE.LineBasicMaterial color "#13e425" opacity 0.15 transparent）
进入动画: useFrame 里 scale 从 0 弹性到 1（或简单 t 插值 + 缓出）, 每个节点 delay = index * 120ms
categoryColor: 主题 #13e425 / 概念 #4d9fff / 疑问 #ffb84d / 默认 #13e425
```

## 行为
- 点击节点 → setSelected(node) → 右下浮层; 点空白处 → 关闭浮层
- 删除 → removeThoughtNode(id)（confirm 确认）; 节点从场景消失（动画淡出）
- OrbitControls autoRotate（0.6）; 手动拖拽暂停自动旋转? 保持 autoRotate（drei 自带, 拖拽期间暂停）
- 空场景: 显示居中提示 "思维宇宙还是空的 —— 去对话里收录你的理解吧"（text-white/40）
- 性能: 节点 < 100 无需优化; dpr={[1, 2]}
- SSR 安全: Canvas 在 "use client" 组件内挂载即可（fiber v9 处理 hydration）; 若有 SSR 报错, 用 dynamic(() => ..., {ssr:false}) 由 shell 包一层

## 参考
- 原站 3D 场景在登录墙后不可见 → 视觉自由, 但交互语义（节点=理解、可点击、可删除）按设计树
