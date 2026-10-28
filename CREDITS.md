# 素材与来源

## 行星贴图

- 来源：Solar System Scope
- 页面：https://www.solarsystemscope.com/textures/
- 授权：Creative Commons Attribution 4.0 International (CC BY 4.0)
- 使用范围：水星、金星、地球昼面、火星、木星、土星、天王星、海王星、太阳、月球与土星环的环带纹理。
- 处理：原始 2K 贴图被缩放为 1536×768 并重新压缩，最终以 Base64 内嵌在 `textures.js` 中。

## 地球云层、法线与高光

- 来源：Three.js examples（`earth_clouds_1024.png`、`earth_normal_2048.jpg`、`earth_specular_2048.jpg`）
- 原始资料：NASA Visible Earth（公有领域）
- 页面：https://threejs.org/examples/
- 处理：法线贴图缩放为 1024×512；高光贴图反相并柔化后生成海洋/陆地的粗糙度贴图，同样以 Base64 内嵌。

## 3D 引擎

- Three.js r160，MIT License。
- 许可全文见 `vendor/THREE-LICENSE.txt`。

## 原创内容

银河背景、太阳着色器与日冕、行星凹凸与粗糙度材质、土星环阴影、欢迎界面、动效、音景与所有交互逻辑均为本项目原创实现。
