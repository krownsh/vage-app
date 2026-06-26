# 菜價行情 App UI/UX 規格文件

版本：v1.0  
視覺基準：參考附圖「菜價行情列表頁」與「胡蘿蔔行情 Bottom Sheet」  
產品定位：蔬菜水果行情查詢 / 比價 App，不是生鮮賣場，不強調購物車、促銷、下單流程。

---

## 1. 整體設計方向

### 1.1 核心風格

整體風格為「乾淨、溫暖、可愛但不幼稚」的農產品行情工具 App。

畫面要像圖一的寵物健康 App 風格：

- 大量留白
- 奶油色背景
- 大圓角卡片
- 粗黑標題字
- 黃色主色點綴
- 綠色作為農業 / 價格資訊識別色
- 手繪插圖風格，但商品本身要足以辨識
- 介面區塊大、清楚、容易點擊

不要做成：

- 賣場型 UI
- 電商促銷頁
- 購物車導向
- 過度資訊密集的表格 App
- 寫實蔬果照片牆
- 食物有臉、有表情、太卡通

---

## 2. Design Tokens

### 2.1 色彩系統

| Token | 用途 | 色碼 |
|---|---|---|
| `color.bg.base` | 全頁背景 | `#FFF8E8` |
| `color.bg.soft` | 區塊淡底 | `#FFFDF5` |
| `color.card` | 卡片底色 | `#FFFFFF` |
| `color.card.warm` | Bottom Sheet / 重要區塊底色 | `#FFFBF1` |
| `color.primary.yellow` | 主按鈕 / 選中 Chip / FAB | `#FFC51B` |
| `color.primary.yellow.dark` | 黃色描邊 / 陰影 | `#D99A00` |
| `color.primary.green` | 主綠色 / 農業資料 / 價格趨勢 | `#236B34` |
| `color.green.soft` | 綠色標籤底 | `#E8F2D8` |
| `color.green.light` | 淡綠裝飾 | `#F1F7E8` |
| `color.orange` | 根莖類 / 暖色點綴 | `#F47B20` |
| `color.purple` | 未分類標籤 | `#A674FF` |
| `color.purple.soft` | 未分類標籤底 | `#EFE3FF` |
| `color.text.main` | 主要文字 | `#111111` |
| `color.text.secondary` | 次要文字 | `#5D5D5D` |
| `color.text.muted` | 輔助文字 / placeholder | `#999999` |
| `color.border.light` | 卡片描邊 | `#EFE2C7` |
| `color.border.medium` | Chip / 輸入框描邊 | `#E2CFA9` |
| `color.overlay` | Modal 遮罩 | `rgba(0,0,0,0.58)` |

### 2.2 字型

推薦字型順序：

```css
font-family: "LINE Seed Sans TC", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
```

若無法使用 LINE Seed Sans TC，可直接使用 Noto Sans TC。  
標題需使用較圓、較厚的字重，整體接近附圖中「粗黑、柔和、圓潤」的感覺。

### 2.3 字級與字重

| 名稱 | 用途 | Font Size | Line Height | Weight |
|---|---|---:|---:|---:|
| `display.title` | 首頁大標「菜價行情」 | 36px | 42px | 900 |
| `sheet.title` | Bottom Sheet 品項名稱 | 32px | 38px | 900 |
| `section.title` | 區塊標題 | 20px | 28px | 800 |
| `card.title` | 列表品項名稱 | 22px | 28px | 800 |
| `card.price` | 列表價格 | 34px | 40px | 900 |
| `sheet.price` | 詳情大價格 | 44px | 52px | 900 |
| `body.large` | 表格主文字 | 18px | 26px | 700 |
| `body.medium` | 一般文字 | 16px | 24px | 500 |
| `body.small` | 單位 / 輔助文字 | 14px | 20px | 500 |
| `label` | 分類標籤 | 13px | 18px | 700 |
| `caption` | 更新日期 / placeholder | 14px | 20px | 500 |

文字原則：

- 主要資訊一律加粗，不要細字。
- 價格數字要非常醒目，使用 900 字重。
- 單位文字縮小並降低對比，例如 `元/kg` 使用 14px、灰色。
- 標題字不要使用太正式的黑體，需偏圓潤。

### 2.4 間距系統

使用 4px 基準倍數。

| Token | 數值 | 用途 |
|---|---:|---|
| `space.4` | 4px | 圖示與文字細縫 |
| `space.8` | 8px | Chip 內距 / 小元素間距 |
| `space.12` | 12px | 小區塊間距 |
| `space.16` | 16px | 卡片內距 / 元件間距 |
| `space.20` | 20px | 區塊上下間距 |
| `space.24` | 24px | 頁面左右 padding |
| `space.32` | 32px | Header 與內容大間距 |
| `space.40` | 40px | 頁首留白 |

### 2.5 圓角

| Token | 數值 | 用途 |
|---|---:|---|
| `radius.sm` | 10px | 小標籤 |
| `radius.md` | 16px | Chip / 小卡 |
| `radius.lg` | 22px | 搜尋框 / 商品列卡片 |
| `radius.xl` | 28px | 大區塊卡片 |
| `radius.sheet` | 36px 36px 0 0 | Bottom Sheet 上緣 |
| `radius.pill` | 999px | 膠囊按鈕 |

### 2.6 陰影

陰影要很淡，偏柔和，不要 Material Design 那種重陰影。

```css
shadow.card = 0 8px 24px rgba(80, 55, 20, 0.08)
shadow.fab = 0 8px 18px rgba(80, 55, 20, 0.22)
shadow.sheet = 0 -12px 40px rgba(0, 0, 0, 0.16)
```

---

## 3. App 結構

本組 UI 主要包含兩個狀態：

1. 行情列表頁
2. 品項詳情 Bottom Sheet

### 3.1 行情列表頁功能重點

首頁只保留核心行為：

- 搜尋作物
- 切換地區
- 切換分類
- 查看行情列表
- 收藏 / 分享
- 新增我看到的價格

不要在首頁加入太多功能，例如促銷、商城、推薦商品、快速下單、會員任務等。

### 3.2 品項詳情頁功能重點

Bottom Sheet 只處理單一品項的行情資訊：

- 品項名稱
- 分類
- 三市場加權均價
- 各市場行情
- 變體明細
- 我看到的價格輸入
- 單位切換
- 近 30 天趨勢圖

---

## 4. Layout 規格：行情列表頁

### 4.1 畫面基準

建議以 iPhone 15 / 393px 寬作為主要設計基準。

```text
screen width: 393px
safe area top: 44px
content horizontal padding: 24px
bottom safe area: 24px
```

整頁背景使用 `color.bg.base`，不可用純白。

### 4.2 Header 區

Header 包含：

- 時間狀態列
- 大標題「菜價行情」
- 農業資料 badge
- 右上蔬菜籃插圖

#### Header 位置

```text
page padding-left: 24px
page padding-right: 24px
top from safe area: 24px
header height: 128px
```

#### 大標題

```text
text: 菜價行情
font-size: 36px
line-height: 42px
font-weight: 900
color: #111111
letter-spacing: -0.5px
margin-top: 24px
margin-bottom: 8px
```

#### 農業資料 Badge

```text
height: 30px
padding: 0 14px
border-radius: 999px
background: #E8F2D8
font-size: 15px
font-weight: 700
color: #236B34
icon-size: 16px
gap: 6px
```

#### 右上插圖

```text
width: 136px
height: 100px
position: absolute
right: 18px
top: 48px
```

插圖應為蔬菜籃：蔬菜、白蘿蔔、番茄、南瓜或青椒。  
不放臉，不放表情。  
需使用粗黑手繪外框與扁平色塊。

---

## 5. 搜尋框

搜尋框為全寬圓角膠囊輸入框。

```text
height: 58px
margin-top: 18px
padding-left: 20px
padding-right: 20px
border-radius: 24px
background: #FFFFFF
border: 1px solid #E2CFA9
box-shadow: none
```

文字：

```text
placeholder: 搜尋作物...
font-size: 17px
font-weight: 500
color: #999999
```

Icon：

```text
search icon size: 24px
stroke-width: 2.4px
color: #4E4E4E
gap between icon and text: 12px
```

---

## 6. 地區切換 Chips

地區列包含：定位 icon chip + 城市 chip。

```text
container margin-top: 22px
height: 46px
gap: 10px
```

### 6.1 定位 icon chip

```text
width: 46px
height: 46px
border-radius: 999px
background: #E8F2D8
border: 1.5px solid #236B34
icon-size: 22px
icon-color: #236B34
```

### 6.2 城市 chip

未選取：

```text
height: 42px
padding: 0 20px
border-radius: 999px
background: transparent
border: 1px solid #E2CFA9
font-size: 16px
font-weight: 600
color: #111111
```

選取狀態：

```text
background: #236B34
border: none
color: #FFFFFF
```

附圖中第一版使用白底描邊，若需要強化目前地區，可套用綠底選取狀態。

---

## 7. 分類切換 Chips

分類 chip 放在一個白色圓角容器內，可水平滑動。

```text
container height: 64px
container margin-top: 24px
container padding: 10px 12px
container border-radius: 24px
container background: #FFFFFF
container border: 1px solid rgba(226,207,169,0.5)
chip gap: 10px
```

### 7.1 分類 chip 未選取

```text
height: 42px
padding: 0 18px
border-radius: 999px
background: #FFFDF5
border: 1px solid #E2CFA9
font-size: 16px
font-weight: 600
color: #222222
```

### 7.2 分類 chip 選取

```text
height: 42px
padding: 0 20px
border-radius: 999px
background: #FFC51B
border: 1.5px solid #D99A00
font-size: 16px
font-weight: 700
color: #111111
box-shadow: 0 4px 8px rgba(217,154,0,0.18)
```

分類順序建議：

```text
全部 / 葉菜類 / 果菜類 / 瓜菜類 / 根莖類 / 花菜類 / 豆菜類
```

---

## 8. 更新資訊列

```text
margin-top: 22px
height: 28px
icon-size: 22px
icon-color: #236B34
text: 行情更新於 2026-06-26
font-size: 17px
font-weight: 600
color: #222222
gap: 8px
```

---

## 9. 行情列表 Card

### 9.1 Card 外觀

每一列是一張大卡片，不要像傳統 table list。

```text
height: 82px ~ 90px
width: full
margin-bottom: 12px
padding: 12px 18px 12px 16px
border-radius: 22px
background: #FFFFFF
box-shadow: 0 8px 24px rgba(80,55,20,0.08)
border: none
```

列表間距要寬鬆，讓每張卡有呼吸感。

### 9.2 Card 內容結構

由左到右：

```text
[作物插圖] [名稱 + 分類標籤 + 價格] [收藏 icon] [分享 icon] [單位]
```

### 9.3 作物插圖區

```text
image wrapper width: 68px
image wrapper height: 68px
border-radius: 999px
background: #FFF4D8
margin-right: 18px
image max-width: 58px
image max-height: 58px
```

插圖要置中。  
蔬菜水果不能有表情。  
可使用輕微手繪線條、粗外框、簡化陰影。

### 9.4 品項名稱

```text
font-size: 22px
line-height: 28px
font-weight: 800
color: #111111
margin-bottom: 6px
```

### 9.5 分類標籤

標籤放在品項名稱右側，垂直置中。

```text
height: 22px
padding: 0 8px
border-radius: 999px
font-size: 13px
font-weight: 700
line-height: 22px
```

分類顏色：

| 分類 | Background | Text |
|---|---|---|
| 葉菜類 | `#E8F2D8` | `#236B34` |
| 果菜類 | `#E8F2D8` | `#236B34` |
| 瓜菜類 | `#E8F2D8` | `#236B34` |
| 根莖類 | `#F8E8C8` | `#8A5A00` |
| 花菜類 | `#FFF1C7` | `#B67800` |
| 豆菜類 | `#E8F2D8` | `#236B34` |
| 未分類 | `#EFE3FF` | `#7B48E8` |

### 9.6 價格文字

```text
font-size: 34px
line-height: 38px
font-weight: 900
color: #111111
letter-spacing: -0.5px
```

價格前綴 `$` 與數字同尺寸。  
若產品要正式一點，可改為 `NT$`，但此視覺建議保留 `$`，簡潔且醒目。

### 9.7 單位文字

```text
font-size: 15px
font-weight: 500
color: #5D5D5D
align-self: flex-end
margin-bottom: 10px
```

範例：

```text
元/kg
元/斤
元/包
```

### 9.8 收藏 / 分享 icon

```text
icon size: 24px
stroke-width: 2px
color: #4E4E4E
gap: 18px
hit area: 44px x 44px
```

收藏 active：

```text
fill: #FF6B4A
stroke: #FF6B4A
```

分享 icon 保持 outline，不要太搶眼。

---

## 10. Floating Action Button

右下角黃色 FAB 用於「新增我看到的價格」。

```text
width: 68px
height: 68px
position: fixed
right: 22px
bottom: 24px
border-radius: 999px
background: #FFC51B
border: 2px solid #111111
box-shadow: 0 8px 18px rgba(80,55,20,0.22)
icon-size: 34px
icon-color: #111111
```

Icon 建議：

- 加號方框
- 加號
- 筆記新增

不要使用購物車 icon，避免誤解成賣場。

---

## 11. Bottom Sheet 詳情頁

### 11.1 開啟狀態

點擊列表卡片後，底部彈出 Bottom Sheet。  
背景列表頁需變暗但仍可辨識。

```text
overlay background: rgba(0,0,0,0.58)
sheet width: 100%
sheet max-height: 82vh
sheet bottom: 0
sheet border-radius: 36px 36px 0 0
sheet background: #FFFBF1
sheet padding: 28px 24px 32px
sheet shadow: 0 -12px 40px rgba(0,0,0,0.16)
```

### 11.2 Sheet Drag Handle

```text
width: 54px
height: 5px
border-radius: 999px
background: #CFC5B5
margin: 0 auto 18px
```

### 11.3 關閉按鈕

```text
width: 48px
height: 48px
position: top 24px right 24px
border-radius: 999px
background: #F3EAD9
icon-size: 26px
icon-color: #111111
```

### 11.4 Sheet 標題

```text
text: 胡蘿蔔
font-size: 32px
line-height: 38px
font-weight: 900
color: #111111
margin-bottom: 6px
```

分類標籤放標題下方。

```text
height: 24px
padding: 0 10px
border-radius: 999px
font-size: 14px
font-weight: 700
```

---

## 12. Bottom Sheet：均價 Summary Card

這是詳情頁最重要的資訊卡。

```text
height: 104px
margin-top: 26px
padding: 18px 22px
border-radius: 22px
background: linear-gradient(90deg, #FFFDF5 0%, #FFF1C7 100%)
border: 1px solid #F1D89F
```

內容排列：

```text
[作物小圖] [三市場加權均價] [大價格] [單位]
```

### 12.1 作物圖

```text
width: 64px
height: 64px
background: #FFF4D8
border-radius: 999px
image max: 54px
```

### 12.2 Summary 文字

```text
label font-size: 20px
label font-weight: 700
label color: #111111
```

### 12.3 大價格

```text
font-size: 44px
line-height: 52px
font-weight: 900
color: #111111
letter-spacing: -1px
```

單位：

```text
font-size: 18px
font-weight: 600
color: #111111
margin-left: 6px
```

---

## 13. Bottom Sheet：市場行情表

### 13.1 區塊標題

```text
text: 市場行情（元/公斤）
font-size: 18px
font-weight: 800
line-height: 26px
margin-top: 28px
margin-bottom: 12px
```

### 13.2 表格 Card

```text
border-radius: 18px
background: #FFFFFF
border: 1px solid #E2CFA9
overflow: hidden
```

### 13.3 Row

```text
height: 48px
padding: 0 18px
border-bottom: 1px solid #EFE2C7
```

最後一列不需要 border-bottom。

左側市場名稱：

```text
font-size: 18px
font-weight: 700
color: #111111
```

右側價格：

```text
font-size: 18px
font-weight: 900
color: #111111
```

單位：

```text
font-size: 13px
font-weight: 500
color: #5D5D5D
margin-left: 4px
```

---

## 14. Bottom Sheet：變體明細表

### 14.1 表格用途

顯示同品項不同規格的價格，例如：

```text
胡蘿蔔-未洗
胡蘿蔔-清洗
胡蘿蔔-進口
```

### 14.2 外觀

```text
border-radius: 18px
background: #FFFFFF
border: 1px solid #E2CFA9
overflow: hidden
```

### 14.3 Row

```text
height: 44px
padding: 0 16px
border-bottom: 1px solid #EFE2C7
```

品項變體名稱：

```text
font-size: 17px
font-weight: 800
color: #111111
width: 120px
```

城市價格：

```text
font-size: 14px
font-weight: 500
color: #5D5D5D
```

價格數字：

```text
font-weight: 900
color: #111111
```

若無資料：

```text
text: -
color: #999999
```

---

## 15. Bottom Sheet：我看到的價格

### 15.1 輸入框

```text
height: 52px
border-radius: 14px
background: #FFFFFF
border: 1px solid #E2CFA9
padding: 0 16px
font-size: 17px
font-weight: 500
```

placeholder：

```text
輸入價格
font-size: 17px
color: #999999
```

右側單位：

```text
元/kg
font-size: 16px
font-weight: 600
color: #5D5D5D
```

### 15.2 單位切換 Chips

```text
margin-top: 12px
gap: 12px
```

未選取：

```text
height: 36px
min-width: 46px
padding: 0 16px
border-radius: 999px
background: #FFFDF5
border: 1px solid #E2CFA9
font-size: 15px
font-weight: 600
color: #111111
```

選取：

```text
background: #FFC51B
border: 1.5px solid #D99A00
color: #111111
font-weight: 800
```

單位順序：

```text
斤 / 包 / kg / 磅 / 盒
```

---

## 16. Bottom Sheet：近 30 天趨勢圖

### 16.1 圖表區塊

```text
margin-top: 22px
chart-card height: 210px
padding: 16px 16px 12px
border-radius: 20px
background: #FFFFFF
border: 1px solid #EFE2C7
```

### 16.2 圖表樣式

```text
line color: #168A3A
line width: 3px
point radius: 4px
active point radius: 7px
active point fill: #FFC51B
active point stroke: #111111
average line: dashed #9A9A9A, 2px
grid line: #DDE3E8, 1px
axis label color: #777777
axis label font-size: 14px
```

最高點標示：

```text
text: 高 $22.1
font-size: 15px
font-weight: 800
color: #FF2D2D
position: above active point
```

平均線右側標示：

```text
text: 均
font-size: 15px
font-weight: 700
color: #777777
```

---

## 17. 插圖風格規範

### 17.1 整體插圖風格

插圖必須維持「手繪、乾淨、友善」但不能變成幼稚卡通。

應符合：

- 2D 手繪 icon / sticker 風格
- 黑色或深棕色粗外框
- 扁平色塊 + 少量陰影
- 蔬果比例可略微可愛化，但不可失真
- 每個品項必須一眼可辨識
- 不使用照片
- 不使用過度寫實紋理
- 不使用水彩髒污感
- 不使用密集線條
- 不使用食物表情

### 17.2 描線

```text
outline color: #111111 或 #2A241A
outline width: 2px ~ 3px
inner detail line width: 1px ~ 1.5px
```

### 17.3 色彩

- 葉菜：主色 `#6FAF4B`、深綠 `#236B34`、淺綠 `#B9D982`
- 胡蘿蔔：主色 `#F47B20`、暗部 `#D95A14`、葉子 `#4F9A3D`
- 南瓜 / 蛋黃果：主色 `#F6C33B`、暗部 `#D99A00`
- 冬瓜 / 瓜類：主色 `#4F8F3A`、切面 `#EEF5D6`
- 橄欖：主色 `#7EA83C`、暗部 `#4F6F22`

### 17.4 不可接受的插圖方向

避免：

- 蔬菜葉脈過度密集，造成噁心或病態感
- 立體感過重，變成油膩寫實插畫
- 過多雜色噪點
- 食物有眼睛嘴巴
- 超 Q 版、兒童教材風
- 太像 stock photo tracing
- 太像生鮮電商商品照

---

## 18. 互動狀態

### 18.1 Card 點擊

```text
pressed scale: 0.98
pressed background: #FFF8E8
transition: 120ms ease-out
```

點擊卡片開啟 Bottom Sheet。

### 18.2 Chip 點擊

```text
transition: 150ms ease-out
selected background change
selected font-weight: 700 或 800
```

### 18.3 搜尋 Focus

```text
border-color: #FFC51B
box-shadow: 0 0 0 3px rgba(255,197,27,0.2)
```

### 18.4 Favorite

未收藏：outline heart  
已收藏：橘紅實心 heart

```text
active color: #FF6B4A
animation: scale 0.8 → 1.12 → 1
transition: 180ms
```

---

## 19. 內容文案規則

### 19.1 App 名稱

建議：

```text
菜價行情
```

副標：

```text
聰明比價・天天省
```

### 19.2 Placeholder

```text
搜尋作物...
```

不要使用太長 placeholder，例如「搜尋蔬菜、水果、品項...」。

### 19.3 更新資訊

```text
行情更新於 2026-06-26
```

### 19.4 詳情均價

```text
三市場加權均價
```

### 19.5 輸入區

```text
我看到的價格
輸入價格
```

---

## 20. 可用元件命名建議

```text
PriceMarketHomePage
MarketHeader
AgricultureBadge
CropSearchBar
RegionChipList
CategoryChipList
MarketUpdatedLabel
CropPriceCard
CropIcon
FavoriteButton
ShareButton
AddPriceFab
CropDetailBottomSheet
AveragePriceCard
MarketPriceTable
VariantPriceTable
SeenPriceInput
UnitChipGroup
PriceTrendChart
```

---

## 21. 前端切版注意事項

1. 頁面左右 padding 固定 24px，不要壓到邊界。
2. 商品卡高度不可低於 82px，否則整體會失去附圖的大塊狀感。
3. 卡片內價格必須比品項名稱更醒目。
4. 分類 chip 可水平滑動，不要硬塞換行導致畫面雜亂。
5. Bottom Sheet 內容若超出高度，內部滾動，不要整頁跳動。
6. FAB 不能擋住最後一張列表卡的主要價格資訊。
7. 插圖需使用同一套風格，不可一張寫實、一張卡通、一張水彩混用。
8. 不要加入購物車、限時促銷、折扣標籤，避免產品定位偏成賣場。
9. 所有按鈕 hit area 至少 44px。
10. 價格單位要固定對齊，列表掃讀才會舒服。

---

## 22. CSS / Token 範例

```css
:root {
  --bg-base: #FFF8E8;
  --bg-soft: #FFFDF5;
  --card: #FFFFFF;
  --card-warm: #FFFBF1;

  --yellow: #FFC51B;
  --yellow-dark: #D99A00;
  --green: #236B34;
  --green-soft: #E8F2D8;

  --text-main: #111111;
  --text-secondary: #5D5D5D;
  --text-muted: #999999;

  --border-light: #EFE2C7;
  --border-medium: #E2CFA9;

  --radius-card: 22px;
  --radius-sheet: 36px;
  --radius-pill: 999px;

  --shadow-card: 0 8px 24px rgba(80, 55, 20, 0.08);
  --shadow-fab: 0 8px 18px rgba(80, 55, 20, 0.22);
}

.page {
  min-height: 100vh;
  background: var(--bg-base);
  padding: 24px 24px 32px;
  font-family: "LINE Seed Sans TC", "Noto Sans TC", "PingFang TC", sans-serif;
  color: var(--text-main);
}

.page-title {
  font-size: 36px;
  line-height: 42px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.crop-card {
  height: 86px;
  padding: 12px 18px 12px 16px;
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow-card);
}

.crop-name {
  font-size: 22px;
  line-height: 28px;
  font-weight: 800;
}

.crop-price {
  font-size: 34px;
  line-height: 38px;
  font-weight: 900;
  letter-spacing: -0.5px;
}
```

---

## 23. 驗收標準

完成後畫面應符合以下條件：

- 第一眼像「行情工具 App」，不是商城。
- 背景是溫暖奶油色，不是純白。
- 標題大、粗、黑，視覺中心明確。
- 卡片夠大，手指好點擊。
- 列表資訊只保留：品項、分類、價格、單位、收藏、分享。
- Bottom Sheet 的均價是最醒目的資訊。
- 插圖有手繪感，但每個蔬果都能辨識。
- 蔬果沒有臉、沒有表情。
- 整套 UI 保持黃、綠、奶油白三個主色，不雜亂。
- 任何新增功能都不能破壞「簡潔比價」定位。
