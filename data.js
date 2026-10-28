/* CLOVE — planetary dataset */
(function () {
  "use strict";

  const PLANETS = [
    {
      id: "mercury",
      zh: "水星",
      en: "MERCURY",
      type: "类地行星",
      tagline: "离太阳最近的灰色世界",
      desc:
        "水星是太阳系中最小、也是离太阳最近的行星。它几乎没有大气来保存热量，因此白天可达 427°C，夜晚却骤降至 −173°C。",
      distance: 0.39,
      stats: [
        { label: "DIAMETER", value: "4,879", unit: "km" },
        { label: "ORBITAL PERIOD", value: "88", unit: "天" },
        { label: "ROTATION", value: "58.6", unit: "天" },
        { label: "MOONS", value: "0", unit: "颗" }
      ],
      tempMin: -173,
      tempMax: 427,
      tempLabel: "−173 / 427°C",
      highlights: [
        { name: "卡洛里盆地", value: "Ø 1,550 km" },
        { name: "轨道偏心率", value: "0.2056" },
        { name: "昼夜温差", value: "600 °C" }
      ],
      fact: "水星轨道让它近日点跑得更快。站在表面，你会看到太阳忽大忽小，甚至短暂倒退。",
      accent: "#c9b9a6",
      accentRgb: "201, 185, 166",
      radius: 0.78,
      orbit: 13.4,
      orbitSpeed: 0.1,
      spin: 0.06,
      tilt: 0.03,
      incl: 7.0,
      initialAngle: 0.55,
      texture: "mercury",
      zoom: 8.6,
      phi: 1.27,
      theta: 0.45,
      drift: 0.013
    },
    {
      id: "venus",
      zh: "金星",
      en: "VENUS",
      type: "类地行星",
      tagline: "被金色云层包裹的炼狱",
      desc:
        "金星大小与地球相近，却拥有失控的温室效应。厚达数十公里的硫酸云将热量锁在表面，使它成为太阳系最炽热的行星。",
      distance: 0.72,
      stats: [
        { label: "DIAMETER", value: "12,104", unit: "km" },
        { label: "ORBITAL PERIOD", value: "224.7", unit: "天" },
        { label: "ROTATION", value: "243", unit: "天·逆行" },
        { label: "MOONS", value: "0", unit: "颗" }
      ],
      tempMin: 440,
      tempMax: 480,
      tempLabel: "≈ 464°C",
      highlights: [
        { name: "地表温度", value: "464 °C" },
        { name: "大气压", value: "92 × 地球" },
        { name: "自转方向", value: "逆行" }
      ],
      fact: "在金星上，太阳从西边升起。它的一天比一年还要漫长。",
      accent: "#e8bd7a",
      accentRgb: "232, 189, 122",
      radius: 1.38,
      orbit: 18.6,
      orbitSpeed: 0.072,
      spin: -0.025,
      tilt: 2.6,
      incl: 3.4,
      initialAngle: 2.3,
      texture: "venus",
      zoom: 8.4,
      phi: 1.33,
      theta: 1.1,
      drift: 0.009
    },
    {
      id: "earth",
      zh: "地球",
      en: "EARTH",
      type: "宜居行星",
      tagline: "目前已知唯一的蓝色家园",
      desc:
        "液态水、板块运动与磁场共同塑造了地球。它位于恒星的宜居带内，也是我们目前唯一确认存在生命的世界。",
      distance: 1.0,
      stats: [
        { label: "DIAMETER", value: "12,742", unit: "km" },
        { label: "ORBITAL PERIOD", value: "365.25", unit: "天" },
        { label: "ROTATION", value: "23h 56m", unit: "" },
        { label: "MOONS", value: "1", unit: "颗" }
      ],
      tempMin: -88,
      tempMax: 58,
      tempLabel: "−88 / 58°C",
      highlights: [
        { name: "海洋覆盖率", value: "71 %" },
        { name: "大气含氧量", value: "21 %" },
        { name: "磁场强度", value: "25–65 μT" }
      ],
      fact: "地球并不是完美的球体。自转使它赤道略鼓，赤道直径比极直径多出约 43 公里。",
      accent: "#7fb8e8",
      accentRgb: "127, 184, 232",
      radius: 1.45,
      orbit: 23.8,
      orbitSpeed: 0.058,
      spin: 0.24,
      tilt: 23.4,
      incl: 0,
      initialAngle: 4.1,
      texture: "earth",
      zoom: 8.8,
      phi: 1.14,
      theta: -0.7,
      drift: 0.012
    },
    {
      id: "mars",
      zh: "火星",
      en: "MARS",
      type: "类地行星",
      tagline: "赤铁矿色的荒漠世界",
      desc:
        "火星拥有太阳系最高的火山与最长的峡谷。稀薄的大气无法留住热量，但古老河床与极地冰盖仍记录着它湿润的过去。",
      distance: 1.52,
      stats: [
        { label: "DIAMETER", value: "6,779", unit: "km" },
        { label: "ORBITAL PERIOD", value: "687", unit: "天" },
        { label: "ROTATION", value: "24h 37m", unit: "" },
        { label: "MOONS", value: "2", unit: "颗" }
      ],
      tempMin: -143,
      tempMax: 35,
      tempLabel: "−143 / 35°C",
      highlights: [
        { name: "奥林帕斯山", value: "21.9 km" },
        { name: "水手号峡谷", value: "4,000 km" },
        { name: "地表大气压", value: "0.6 % 地球" }
      ],
      fact: "火星的日落是蓝色的。稀薄尘埃散射光线的方式，让太阳落下的方向泛起冷蓝色光晕。",
      accent: "#e08b63",
      accentRgb: "224, 139, 99",
      radius: 1.02,
      orbit: 29.8,
      orbitSpeed: 0.045,
      spin: 0.22,
      tilt: 25.2,
      incl: 1.9,
      initialAngle: 5.6,
      texture: "mars",
      zoom: 8.8,
      phi: 1.2,
      theta: 2.1,
      drift: 0.014
    },
    {
      id: "jupiter",
      zh: "木星",
      en: "JUPITER",
      type: "气态巨行星",
      tagline: "太阳系的巨人风暴",
      desc:
        "木星的质量是其余七颗行星总和的两倍以上。它的条纹云带由高速喷流编织而成，大红斑是一场已经持续数百年的巨型风暴。",
      distance: 5.2,
      stats: [
        { label: "DIAMETER", value: "139,820", unit: "km" },
        { label: "ORBITAL PERIOD", value: "11.86", unit: "年" },
        { label: "ROTATION", value: "9h 56m", unit: "" },
        { label: "MOONS", value: "95", unit: "颗" }
      ],
      tempMin: -145,
      tempMax: -80,
      tempLabel: "≈ −108°C",
      highlights: [
        { name: "大红斑", value: "1.3 × 地球" },
        { name: "质量", value: "317.8 × 地球" },
        { name: "伽利略卫星", value: "4 颗" }
      ],
      fact: "木星没有可以站立的表面。向它降落，大气会逐渐变密，最终在高温高压中失去明确边界。",
      accent: "#d9b18d",
      accentRgb: "217, 177, 141",
      radius: 2.95,
      orbit: 38.8,
      orbitSpeed: 0.028,
      spin: 0.5,
      tilt: 3.1,
      incl: 1.3,
      initialAngle: 1.4,
      texture: "jupiter",
      zoom: 9.3,
      phi: 1.42,
      theta: 0.9,
      drift: 0.018
    },
    {
      id: "saturn",
      zh: "土星",
      en: "SATURN",
      type: "气态巨行星",
      tagline: "环带之上的淡金色宝石",
      desc:
        "土星的平均密度小于水，是太阳系中唯一能“浮”在水上的行星。它的环由无数冰粒与岩屑组成，宽度可达 28 万公里，厚度却只有数十米。",
      distance: 9.58,
      stats: [
        { label: "DIAMETER", value: "116,460", unit: "km" },
        { label: "ORBITAL PERIOD", value: "29.45", unit: "年" },
        { label: "ROTATION", value: "10h 42m", unit: "" },
        { label: "MOONS", value: "146", unit: "颗" }
      ],
      tempMin: -178,
      tempMax: -113,
      tempLabel: "≈ −139°C",
      highlights: [
        { name: "环系宽度", value: "282,000 km" },
        { name: "平均密度", value: "0.687 g/cm³" },
        { name: "极地涡旋", value: "六边形" }
      ],
      fact: "土星环正在缓慢消失。环中的冰粒不断被引力拉入土星大气，数亿年后，这顶光环将不再完整。",
      accent: "#e8d3a4",
      accentRgb: "232, 211, 164",
      radius: 2.6,
      orbit: 47.8,
      orbitSpeed: 0.02,
      spin: 0.44,
      tilt: 26.7,
      incl: 2.5,
      initialAngle: 3.2,
      texture: "saturn",
      zoom: 9.0,
      phi: 1.1,
      theta: 1.7,
      drift: 0.011,
      rings: { inner: 1.32, outer: 2.28, type: "saturn" }
    },
    {
      id: "uranus",
      zh: "天王星",
      en: "URANUS",
      type: "冰巨行星",
      tagline: "侧躺旋转的冰巨星",
      desc:
        "天王星的自转轴倾斜约 98°，几乎完全侧躺。它绕太阳滚动前进，一个极区会连续 42 年朝向太阳，随后陷入 42 年的长夜。",
      distance: 19.2,
      stats: [
        { label: "DIAMETER", value: "50,724", unit: "km" },
        { label: "ORBITAL PERIOD", value: "84", unit: "年" },
        { label: "ROTATION", value: "17h 14m", unit: "逆行" },
        { label: "MOONS", value: "28", unit: "颗" }
      ],
      tempMin: -224,
      tempMax: -197,
      tempLabel: "≈ −197°C",
      highlights: [
        { name: "自转轴倾角", value: "97.8°" },
        { name: "最低温度", value: "−224 °C" },
        { name: "暗环", value: "13 道" }
      ],
      fact: "天王星是第一颗用望远镜发现的行星。威廉·赫歇尔在 1781 年看到它时，最初以为它是一颗彗星。",
      accent: "#8fd7dc",
      accentRgb: "143, 215, 220",
      radius: 1.75,
      orbit: 56.2,
      orbitSpeed: 0.014,
      spin: 0.3,
      tilt: 97.8,
      incl: 0.8,
      initialAngle: 0.4,
      texture: "uranus",
      zoom: 8.7,
      phi: 1.28,
      theta: 2.8,
      drift: 0.016,
      rings: { inner: 1.55, outer: 1.95, type: "uranus" }
    },
    {
      id: "neptune",
      zh: "海王星",
      en: "NEPTUNE",
      type: "冰巨行星",
      tagline: "风暴最猛烈的深蓝边境",
      desc:
        "海王星是离太阳最远的行星，也是太阳系风速最高的地方。它的深蓝色来自大气中的甲烷，而内部仍残留着形成时的热量。",
      distance: 30.05,
      stats: [
        { label: "DIAMETER", value: "49,244", unit: "km" },
        { label: "ORBITAL PERIOD", value: "164.8", unit: "年" },
        { label: "ROTATION", value: "16h 06m", unit: "" },
        { label: "MOONS", value: "16", unit: "颗" }
      ],
      tempMin: -218,
      tempMax: -201,
      tempLabel: "≈ −201°C",
      highlights: [
        { name: "最高风速", value: "2,100 km/h" },
        { name: "距日距离", value: "30.05 AU" },
        { name: "海卫一", value: "逆行轨道" }
      ],
      fact: "海王星是通过数学计算被“预测”出来的。天文学家先算出了它的位置，望远镜随后才在预测点附近找到它。",
      accent: "#6f9fe0",
      accentRgb: "111, 159, 224",
      radius: 1.7,
      orbit: 64.0,
      orbitSpeed: 0.011,
      spin: 0.33,
      tilt: 28.3,
      incl: 1.8,
      initialAngle: 2.5,
      texture: "neptune",
      zoom: 8.9,
      phi: 1.23,
      theta: -0.2,
      drift: 0.015
    }
  ];

  const SYSTEM = {
    id: "sol",
    code: "OBJECT 00 / SOL",
    type: "G2V 主序星",
    zh: "太阳系",
    en: "SOL SYSTEM",
    tagline: "一场持续四十六亿年的引力之舞",
    desc:
      "一颗中年恒星、八颗行星、数百颗卫星与无数冰屑，被同一场引力坍缩塑造。太阳系诞生于约 46 亿年前，而我们正生活在它的一粒蓝色尘埃上。",
    distance: 30.05,
    stats: [
      { label: "STELLAR AGE", value: "46", unit: "亿年" },
      { label: "PLANETS", value: "8", unit: "颗" },
      { label: "KNOWN MOONS", value: "400+", unit: "颗" },
      { label: "HELIOPAUSE", value: "≈120", unit: "AU" }
    ],
    tempMin: 5500,
    tempMax: 5500,
    tempLabel: "5,505°C",
    highlights: [
      { name: "光到地球", value: "8 分 20 秒" },
      { name: "太阳质量占比", value: "99.86 %" },
      { name: "奥尔特云半径", value: "≈100,000 AU" }
    ],
    fact: "太阳系正以约 220 公里/秒的速度绕银河系中心运行。绕行一圈，大约需要 2.3 亿年。",
    accent: "#f2c384",
    accentRgb: "242, 195, 132"
  };

  window.CLOVE_DATA = { PLANETS, SYSTEM };
})();
