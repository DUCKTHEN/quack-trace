const canvas = document.querySelector("#traceCanvas");
const ctx = canvas.getContext("2d");
const canvasPanel = canvas.closest(".canvas-panel");
const savedGridOpacityRaw = localStorage.getItem("quackTraceGridOpacity");
const savedGridOpacity = savedGridOpacityRaw === null ? NaN : Number(savedGridOpacityRaw);
const savedPointSizeRaw = localStorage.getItem("quackTracePointSize");
const savedPointSize = savedPointSizeRaw === null ? NaN : Number(savedPointSizeRaw);
const savedSnapToGrid = localStorage.getItem("quackTraceSnapToGrid") === "true";
const savedPointLabels = localStorage.getItem("quackTraceShowPointLabels");
const DEFAULT_IMAGE_OPACITY = 0.3;
const DEFAULT_SHAPE_OPACITY = 0.7;
const DEFAULT_GRID_OPACITY = 0.5;
const DEFAULT_POINT_SIZE = 0.8;

const state = {
  image: null,
  imageName: "untitled",
  view: { x: 40, y: 40, zoom: 1 },
  sourceOffset: { x: 0, y: 0 },
  sourceScale: 1,
  imageOpacity: DEFAULT_IMAGE_OPACITY,
  shapeOpacity: DEFAULT_SHAPE_OPACITY,
  gridOpacity: Number.isFinite(savedGridOpacity) ? Math.min(1, Math.max(0, savedGridOpacity)) : DEFAULT_GRID_OPACITY,
  pointSize: Number.isFinite(savedPointSize) ? Math.min(1, Math.max(0, savedPointSize)) : DEFAULT_POINT_SIZE,
  cursorImagePoint: null,
  loupeZoom: 4,
  mode: "point",
  points: [],
  edges: [],
  faces: [],
  currentPathLast: null,
  currentPathIds: [],
  selectedEdgeIndex: null,
  selectedEdgeIndices: new Set(),
  selectedCurveHandle: null,
  selectedFaceIndex: null,
  selected: new Set(),
  calibrationClicks: [],
  cmPerPixel: null,
  origin: null,
  yUp: false,
  autoConnect: true,
  showGuides: true,
  showCanvasGrid: true,
  showScaleReference: true,
  showPointLabels: savedPointLabels === null ? true : savedPointLabels === "true",
  snapToGrid: savedSnapToGrid,
  areaLock: false,
  arrowMoveAmount: 1,
  drag: null,
  spacePanActive: false,
  skipNextCanvasClick: false,
  lastPointClick: null,
  fitViewBefore: null,
  undoStack: [],
  redoStack: [],
  shapeClipboard: null,
  sketchStrokes: [],
  sketchCircles: [],
  dxfGuidePaths: [],
};

const els = {
  brandSound: document.querySelector("#brandSoundButton"),
  imageInput: document.querySelector("#imageInput"),
  sampleButton: document.querySelector("#sampleButton"),
  fitButton: document.querySelector("#fitButton"),
  language: document.querySelector("#languageButton"),
  canvasStatus: document.querySelector("#canvasStatus"),
  pointName: document.querySelector("#pointNameInput"),
  unit: document.querySelector("#unitSelect"),
  knownLength: document.querySelector("#knownLengthInput"),
  knownLengthUnit: document.querySelector("#knownLengthUnit"),
  yUp: document.querySelector("#yUpToggle"),
  autoConnect: document.querySelector("#autoConnectToggle"),
  loupeCanvas: document.querySelector("#loupeCanvas"),
  loupeMinus: document.querySelector("#loupeMinusButton"),
  loupePlus: document.querySelector("#loupePlusButton"),
  loupeScale: document.querySelector("#loupeScale"),
  loupeCoords: document.querySelector("#loupeCoords"),
  coachBubble: document.querySelector("#coachBubble"),
  coachText: document.querySelector("#coachText"),
  scaleStatus: document.querySelector("#scaleStatus"),
  scaleValue: document.querySelector("#scaleValue"),
  pointList: document.querySelector("#pointList"),
  exportText: document.querySelector("#exportText"),
  undo: document.querySelector("#undoButton"),
  connect: document.querySelector("#connectButton"),
  closeShape: document.querySelector("#closeShapeButton"),
  copyJson: document.querySelector("#copyJsonButton"),
  downloadJson: document.querySelector("#downloadJsonButton"),
  downloadSvg: document.querySelector("#downloadSvgButton"),
  downloadCsv: document.querySelector("#downloadCsvButton"),
};

const loupeCtx = els.loupeCanvas.getContext("2d");
els.loupeCanvas.width = 180;
els.loupeCanvas.height = 180;
els.loupeCanvas.style.width = "180px";
els.loupeCanvas.style.height = "180px";
const LOUPE_ZOOMS = [2, 4, 8];
const POINT_HIT_RADIUS = 20;
const FACE_HANDLE_HIT_RADIUS = 18;
const FACE_HANDLE_OUTSET = 12;
const CLOSE_DOUBLE_CLICK_MS = 650;
const GRID_PAPER_MINOR_PX = 22.5;
const GRID_PAPER_MAJOR_PX = GRID_PAPER_MINOR_PX * 5;
const MIN_SOURCE_SCALE = 0.1;
const MAX_SOURCE_SCALE = 8;
const DRAW_COLORS = {
  line: "#f2c037",
  label: "#f8f8f6",
  labelUnderlay: "rgba(16, 17, 20, 0.72)",
  pointStroke: "#20242a",
  selected: "#fff7d7",
  loupeTarget: "#2f7dff",
  handle: "#f2c037",
  handleFill: "#f8f8f6",
  guide: "rgba(154, 160, 168, 0.46)",
  origin: "#f2c037",
  originGuide: "rgba(242, 192, 55, 0.28)",
  rightAngle: "#f2c037",
  faceFill: [255, 255, 255],
  loupeBg: "#16171a",
};

const I18N = {
  ja: {
    "brand.subtitle": "画像から実寸座標を取る製図トレースツール",
    "top.image": "画像",
    "top.sample": "テスト図形",
    "top.fit": "全体表示",
    "top.fitBack": "元の表示に戻す",
    "top.source": "下敷きを動かす",
    "top.sourceTitle": "トレース元の画像や方眼紙だけをドラッグで移動します",
    "top.sketch": "下書きペン",
    "top.sketchTitle": "作図や出力に入らない下書き線を描きます",
    "top.sketchCircle": "下書き円",
    "top.sketchCircleTitle": "作図や出力に入らない下書き円を描きます",
    "top.clearSketch": "下書きを消す",
    "top.clearSketchTitle": "下書きペンと下書き円だけを消します",
    "top.grid": "方眼紙",
    "top.gridTitle": "実寸確認用の方眼紙を下敷きにします",
    "top.language": "English",
    "action.playQuack": "アヒルを鳴かす",
    "action.playQuackReset": "アヒルを鳴かして、点・線・面をリセット",
    "section.operation": "操作",
    "section.operationMode": "操作モード",
    "section.coordinates": "座標",
    "section.scale": "スケール",
    "section.connection": "接続",
    "section.pointList": "点リスト",
    "section.output": "出力",
    "section.record": "記録",
    "section.drawing": "図面",
    "section.python": "Python",
    "label.nextPoint": "次の点名",
    "label.unit": "単位",
    "label.yUp": "Y軸を上向きにする",
    "label.knownLength": "既知の長さ",
    "label.arrowMoveAmount": "方向キー移動量",
    "label.autoConnect": "クリック順に線をつなぐ",
    "label.fileName": "保存名",
    "label.fileNamePlaceholder": "空なら画像名で保存",
    "label.imageOpacity": "画像の濃さ",
    "label.shapeOpacity": "図の濃さ",
    "label.gridOpacity": "方眼の濃さ",
    "label.pointSize": "点サイズ",
    "label.svgNames": "SVGに点名を入れる",
    "label.importOptions": "インポートオプション",
    "label.dxfInternalLines": "DXF内部線も読む",
    "label.dxfCurveFit": "DXFをカーブ化",
    "label.dxfStraightenCurves": "DXFカーブを直線化",
    "label.dxfKeepMarkers": "DXFポイントを保持",
    "label.dxfOriginalGuide": "元DXF線を表示",
    "mode.select": "選択・移動",
    "mode.point": "点を置く",
    "mode.curve": "曲げる",
    "mode.calibrate": "スケール設定",
    "mode.origin": "原点",
    "mode.circle": "円を書く",
    "action.close": "閉じる",
    "action.reset": "リセット",
    "action.resetTitle": "点・線・面をリセット",
    "action.redoTitle": "やり直す",
    "action.undoTitle": "1つ戻す",
    "action.applyScale": "距離を確定",
    "action.applyScaleTitle": "クリックした2点間を、入力した長さとしてスケール設定します",
    "action.areaLock": "面積を保つ",
    "action.areaLockTitle": "点を動かしても閉じた面の面積を保ちます",
    "action.straighten": "直線に戻す",
    "action.straightenTitle": "選択したカーブを直線に戻します",
    "action.horizontal": "水平",
    "action.horizontalTitle": "選択した線を水平にします",
    "action.vertical": "垂直",
    "action.verticalTitle": "選択した線を垂直にします",
    "action.flipFace": "左右反転",
    "action.flipFaceTitle": "選択した閉じた図を左右反転します",
    "action.deleteFace": "図形を削除",
    "action.deleteFaceTitle": "選択した閉じた図と、その図だけで使っている点・線を削除します",
    "action.hideGuides": "ガイド非表示",
    "action.showGuides": "ガイド表示",
    "action.hidePointLabels": "点名非表示",
    "action.showPointLabels": "点名表示",
    "action.pointLabelsTitle": "キャンバス上のポイント番号と点名だけを表示・非表示にします",
    "action.hideCanvasGrid": "方眼非表示",
    "action.showCanvasGrid": "方眼表示",
    "action.snapOn": "スナップON",
    "action.snapOff": "スナップOFF",
    "action.snapTitle": "点と下書きを方眼の小マスに吸着します",
    "action.hideScaleReference": "スケール四角非表示",
    "action.showScaleReference": "スケール四角表示",
    "guide.origin": "0,0",
    "guide.scaleReference": "10 cm",
    "guide.scaleReferenceClamped": "10 cm 目安",
    "action.details": "こまかい調整",
    "export.importJson": "JSON読込",
    "export.importJsonTitle": "Quack TraceのJSON保存から作業状態を読み込みます",
    "export.importDxf": "DXF読込(実験)",
    "export.importDxfTitle": "実験機能です。CAD由来DXFの閉じた外形を読み込み、カーブは直線化して元DXF線をガイド表示します。",
    "export.copyJson": "JSONコピー",
    "export.saveJson": "JSON保存",
    "export.saveCsv": "CSV保存",
    "export.saveSvg": "SVG保存",
    "export.saveDxf": "DXF保存",
    "export.printPdf": "印刷 / PDF",
    "export.printPdfTitle": "実寸の黒線だけを白背景で印刷します。PDF保存はブラウザの印刷画面で選べます",
    "export.saveMdClo": "MD/CLO py保存",
    "export.saveBlender": "Blender py保存",
    "export.ready": "出力OK",
    "export.noScale": "スケール未設定",
    "export.noFace": "閉じた面が必要",
    "print.preparing": "実寸の印刷用ページを開きます。倍率100%・用紙に合わせない設定で確認してください。",
    "print.blocked": "印刷用ページを開けませんでした。ポップアップ許可を確認してください。",
    "print.needScale": "印刷/PDFの前に、スケールを設定してください。",
    "print.needLine": "印刷/PDFの前に、線を作ってください。",
    "scale.unset": "未設定",
    "scale.onePoint": "1点目あり",
    "scale.twoPoints": "2点取得済み",
    "scale.needOneMore": "あと1点",
    "scale.perPixel": "1pxあたり",
    "coach.start": "まず画像か方眼紙を選びます。テスト図形でも試せます。",
    "status.loadImage": "画像を読み込むか、テスト図形を表示してください。",
    "status.select": "点・線・閉じた図を選びます。閉じた図はそのままドラッグで移動できます。",
    "status.boxSelect": "囲った範囲の点を選択します。",
    "status.calibrate": "長さが分かる線の両端を2点クリックして、実寸の長さを入力します。",
    "status.origin": "座標のはじまりにしたい位置をクリックしてください。",
    "status.source": "トレース元の画像や方眼紙だけをドラッグで移動できます。作った点や線は動きません。",
    "status.sketch": "下書きペンです。作図や出力には入りません。",
    "status.sketchCircle": "下書き円です。中心からドラッグして半径を決めます。作図や出力には入りません。",
    "status.circle": "中心からドラッグして、図形としての円を作ります。円は4点と4本のカーブで作ります。",
    "status.circleDrawing": "円の半径を決めています。",
    "status.circleCreated": "円を作りました。4点と4本のカーブで閉じた図形にしています。",
    "status.circleTooSmall": "円が小さすぎます。中心から少しドラッグしてください。",
    "status.sketchCleared": "下書きを消しました。",
    "status.noSketch": "消す下書きがありません。",
    "status.viewPan": "視界だけを移動します。座標・原点・下敷きは動きません。",
    "status.viewPanned": "視界だけを移動しました。座標・原点・下敷きは固定です。",
    "status.pan": "閉じた図の内側をドラッグして、その図だけ移動できます。",
    "status.curve": "線をクリックして曲げます。青いハンドルで形を調整できます。",
    "status.point": "点を置きたい場所をクリックしてください。置いた点はあとから動かせます。",
    "edge.heading": "選択線",
    "edge.none": "線を選択してください",
    "calculator.title": "電卓",
    "calculator.placeholder": "例: 40 / 2 + 3",
    "calculator.result": "結果",
    "calculator.useLength": "長さへ入れる",
    "calculator.clear": "クリア",
    "calculator.backspace": "1字消す",
    "calculator.error": "式を確認してください",
    "delete.none": "削除したい点・線・閉じた図を選択してください。",
    "delete.points": "選択した点を削除しました。",
    "delete.edges": "選択した線を削除しました。",
    "delete.faceBoundary": "閉じた図の外周線は、面がある間は残します。図ごと消す場合は面を選択してください。",
  },
  en: {
    "brand.subtitle": "Pattern tracing tool for real-size coordinates",
    "top.image": "Image",
    "top.sample": "Sample",
    "top.fit": "Fit view",
    "top.fitBack": "Restore view",
    "top.source": "Move underlay",
    "top.sourceTitle": "Drag only the source image or grid paper without moving traced geometry",
    "top.sketch": "Sketch pencil",
    "top.sketchTitle": "Draw freehand guide lines that are not included in traced geometry or exports",
    "top.sketchCircle": "Sketch circle",
    "top.sketchCircleTitle": "Draw guide circles that are not included in traced geometry or exports",
    "top.clearSketch": "Clear sketch",
    "top.clearSketchTitle": "Clear only sketch pencil lines and sketch circles",
    "top.grid": "Grid paper",
    "top.gridTitle": "Use grid paper as the tracing underlay",
    "top.language": "日本語",
    "action.playQuack": "Play duck quack",
    "action.playQuackReset": "Play duck quack and reset points, lines, and shapes",
    "section.operation": "Tools",
    "section.operationMode": "Tool mode",
    "section.coordinates": "Coordinates",
    "section.scale": "Scale",
    "section.connection": "Connect",
    "section.pointList": "Points",
    "section.output": "Export",
    "section.record": "Record",
    "section.drawing": "Drawing",
    "section.python": "Python",
    "label.nextPoint": "Next point",
    "label.unit": "Unit",
    "label.yUp": "Y axis upward",
    "label.knownLength": "Known length",
    "label.arrowMoveAmount": "Arrow key move",
    "label.autoConnect": "Connect lines in click order",
    "label.fileName": "File name",
    "label.fileNamePlaceholder": "Use image name if blank",
    "label.imageOpacity": "Image opacity",
    "label.shapeOpacity": "Shape opacity",
    "label.gridOpacity": "Grid opacity",
    "label.pointSize": "Point size",
    "label.svgNames": "Include point names in SVG",
    "label.importOptions": "Import options",
    "label.dxfInternalLines": "Import DXF internal lines",
    "label.dxfCurveFit": "Fit DXF curves",
    "label.dxfStraightenCurves": "Simplify DXF curves as lines",
    "label.dxfKeepMarkers": "Keep DXF point markers",
    "label.dxfOriginalGuide": "Show original DXF guide",
    "mode.select": "Select / Move",
    "mode.point": "Place point",
    "mode.curve": "Curve",
    "mode.calibrate": "Set scale",
    "mode.origin": "Origin",
    "mode.circle": "Draw circle",
    "action.close": "Close",
    "action.reset": "Reset",
    "action.resetTitle": "Reset points, lines, and faces",
    "action.redoTitle": "Redo",
    "action.undoTitle": "Undo",
    "action.applyScale": "Confirm distance",
    "action.applyScaleTitle": "Use the clicked 2-point distance as the entered real length",
    "action.areaLock": "Keep area",
    "action.areaLockTitle": "Keep the closed face area while moving points",
    "action.straighten": "Straighten",
    "action.straightenTitle": "Return the selected curve to a straight line",
    "action.horizontal": "Horizontal",
    "action.horizontalTitle": "Make the selected line horizontal",
    "action.vertical": "Vertical",
    "action.verticalTitle": "Make the selected line vertical",
    "action.flipFace": "Flip",
    "action.flipFaceTitle": "Flip the selected closed shape horizontally",
    "action.deleteFace": "Delete shape",
    "action.deleteFaceTitle": "Delete the selected closed shape and points used only by that shape",
    "action.hideGuides": "Hide guides",
    "action.showGuides": "Show guides",
    "action.hidePointLabels": "Hide point names",
    "action.showPointLabels": "Show point names",
    "action.pointLabelsTitle": "Show or hide only point numbers and names on the canvas",
    "action.hideCanvasGrid": "Hide grid",
    "action.showCanvasGrid": "Show grid",
    "action.snapOn": "Snap ON",
    "action.snapOff": "Snap OFF",
    "action.snapTitle": "Snap points and sketch guides to the small grid squares",
    "action.hideScaleReference": "Hide scale square",
    "action.showScaleReference": "Show scale square",
    "guide.origin": "0,0",
    "guide.scaleReference": "10 cm",
    "guide.scaleReferenceClamped": "10 cm guide",
    "action.details": "Fine controls",
    "export.importJson": "Import JSON",
    "export.importJsonTitle": "Import a saved Quack Trace JSON work state",
    "export.importDxf": "Import DXF beta",
    "export.importDxfTitle": "Experimental. Import closed outlines from CAD DXF files, simplify curves as editable lines, and show the original DXF as a guide.",
    "export.copyJson": "Copy JSON",
    "export.saveJson": "Save JSON",
    "export.saveCsv": "Save CSV",
    "export.saveSvg": "Save SVG",
    "export.saveDxf": "Save DXF",
    "export.printPdf": "Print / PDF",
    "export.printPdfTitle": "Print only real-size black pattern lines on a white background. Choose Save as PDF in the browser print dialog.",
    "export.saveMdClo": "Save MD/CLO py",
    "export.saveBlender": "Save Blender py",
    "export.ready": "Ready to export",
    "export.noScale": "Scale not set",
    "export.noFace": "Closed face required",
    "print.preparing": "Opening a real-size print page. Check scale 100% and do not fit to page.",
    "print.blocked": "Could not open the print page. Check popup permissions.",
    "print.needScale": "Set the scale before printing or saving PDF.",
    "print.needLine": "Create lines before printing or saving PDF.",
    "scale.unset": "Not set",
    "scale.onePoint": "1 point set",
    "scale.twoPoints": "2 points set",
    "scale.needOneMore": "Need 1 more",
    "scale.perPixel": "Per 1px",
    "coach.start": "Load an image, grid paper, or sample shape to begin.",
    "status.loadImage": "Load an image or show a sample shape.",
    "status.select": "Select points, lines, or closed shapes. Closed shapes can be dragged directly.",
    "status.boxSelect": "Drag a box to select points inside it.",
    "status.calibrate": "Click both ends of a known length, then enter the real length.",
    "status.origin": "Click where the coordinate origin should be.",
    "status.source": "Drag only the source image or grid paper. Traced points and lines stay fixed.",
    "status.sketch": "Sketch pencil. These guide lines are not included in geometry or exports.",
    "status.sketchCircle": "Sketch circle. Drag from the center to set the radius. It is not included in geometry or exports.",
    "status.circle": "Drag from the center to create a real circle shape. It uses 4 points and 4 curved edges.",
    "status.circleDrawing": "Setting the circle radius.",
    "status.circleCreated": "Created a circle as a closed shape with 4 points and 4 curved edges.",
    "status.circleTooSmall": "The circle is too small. Drag farther from the center.",
    "status.sketchCleared": "Cleared the sketch guides.",
    "status.noSketch": "There are no sketch guides to clear.",
    "status.viewPan": "Moving only the view. Coordinates, origin, and underlay stay fixed.",
    "status.viewPanned": "Moved only the view. Coordinates, origin, and underlay stayed fixed.",
    "status.pan": "Drag inside a closed shape to move only that shape.",
    "status.curve": "Click a line to bend it. Use the blue handles to adjust the curve.",
    "status.point": "Click to place points. You can move them later.",
    "edge.heading": "Selected line",
    "edge.none": "Select a line",
    "calculator.title": "Calculator",
    "calculator.placeholder": "e.g. 40 / 2 + 3",
    "calculator.result": "Result",
    "calculator.useLength": "Use as length",
    "calculator.clear": "Clear",
    "calculator.backspace": "Backspace",
    "calculator.error": "Check expression",
    "delete.none": "Select points, lines, or a closed shape to delete.",
    "delete.points": "Deleted selected points.",
    "delete.edges": "Deleted selected lines.",
    "delete.faceBoundary": "Closed-shape boundary lines stay while the face exists. Select the face to delete the shape.",
  },
};

state.language = "en";

function t(key) {
  return I18N[state.language]?.[key] || I18N.ja[key] || key;
}

function setNodeText(selector, key) {
  const node = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (node) node.textContent = t(key);
}

function setButton(button, textKey, titleKey = null) {
  if (!button) return;
  button.textContent = t(textKey);
  if (titleKey) {
    button.title = t(titleKey);
    button.setAttribute("aria-label", t(titleKey));
  }
}

function isTextInputActive() {
  return document.activeElement?.matches("input, textarea, select");
}

function shouldStartViewportPan(event) {
  return event.button === 1 || (event.button === 0 && state.spacePanActive);
}

const toolbarActions = document.querySelector(".toolbar-actions");
if (els.coachBubble && toolbarActions) {
  toolbarActions.before(els.coachBubble);
}

function createDuckCalculator() {
  const image = els.coachBubble?.querySelector("img");
  if (!image) return {};

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "duck-calculator-trigger";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  image.replaceWith(trigger);
  image.setAttribute("aria-hidden", "true");
  trigger.appendChild(image);

  const panel = document.createElement("div");
  panel.className = "duck-calculator-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");

  const header = document.createElement("div");
  header.className = "duck-calculator-header";
  const title = document.createElement("strong");
  title.dataset.i18n = "calculator.title";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "duck-calculator-close";
  close.textContent = "x";
  close.setAttribute("aria-label", "Close");
  header.append(title, close);

  const input = document.createElement("input");
  input.className = "duck-calculator-input";
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.spellcheck = false;

  const resultRow = document.createElement("div");
  resultRow.className = "duck-calculator-result";
  const resultLabel = document.createElement("span");
  resultLabel.dataset.i18n = "calculator.result";
  const resultValue = document.createElement("strong");
  resultValue.textContent = "--";
  resultRow.append(resultLabel, resultValue);

  const keys = document.createElement("div");
  keys.className = "duck-calculator-keys";
  ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "C", "+", "Back", "="].forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.calcKey = key;
    button.textContent = key === "Back" ? "<" : key;
    if (key === "=") button.classList.add("is-primary");
    if (key === "Back" || key === "C") button.classList.add("is-muted");
    keys.appendChild(button);
  });

  const useLength = document.createElement("button");
  useLength.type = "button";
  useLength.className = "duck-calculator-use";
  useLength.dataset.i18n = "calculator.useLength";

  panel.append(header, input, resultRow, keys, useLength);
  document.body.appendChild(panel);

  return { trigger, panel, close, input, resultValue, useLength };
}

const duckCalculator = createDuckCalculator();
const duckQuackAudio = typeof Audio !== "undefined" ? new Audio("./assets/sounds/duck-quacking-37392.mp3") : null;

if (duckQuackAudio) {
  duckQuackAudio.preload = "auto";
  duckQuackAudio.volume = 0.55;
}

const resetButton = document.createElement("button");
resetButton.id = "resetButton";
resetButton.className = "reset-button";
resetButton.type = "button";
resetButton.textContent = "リセット";
resetButton.title = "点・線・面をリセット";
const redoButton = document.createElement("button");
redoButton.id = "redoButton";
redoButton.type = "button";
redoButton.textContent = "Redo";
redoButton.title = "やり直す";
redoButton.setAttribute("aria-label", "やり直す");
els.redo = redoButton;
const pointTools = document.createElement("div");
pointTools.className = "point-tools";
pointTools.appendChild(els.undo);
pointTools.appendChild(redoButton);
els.undo.textContent = "Undo";
els.undo.title = "1つ戻す";
els.undo.setAttribute("aria-label", "1つ戻す");

const modeGrid = document.querySelector(".mode-grid");
const selectModeButton = document.createElement("button");
selectModeButton.className = "mode-button";
selectModeButton.dataset.mode = "select";
selectModeButton.type = "button";
selectModeButton.textContent = "選択・移動";
modeGrid.insertBefore(selectModeButton, modeGrid.firstElementChild);
modeGrid.querySelector('[data-mode="point"]').textContent = "点を置く";
const calibrateModeButton = modeGrid.querySelector('[data-mode="calibrate"]');
calibrateModeButton.textContent = "スケール設定";
const panModeButton = modeGrid.querySelector('[data-mode="pan"]');
if (panModeButton) panModeButton.remove();

const curveModeButton = document.createElement("button");
curveModeButton.className = "mode-button";
curveModeButton.dataset.mode = "curve";
curveModeButton.type = "button";
curveModeButton.textContent = "曲げる";
modeGrid.appendChild(curveModeButton);
modeGrid.appendChild(pointTools);

const originModeButton = modeGrid.querySelector('[data-mode="origin"]');
originModeButton.textContent = "原点";

const scaleSection = document.querySelector(".scale-readout").closest(".panel-section");
const knownLengthLabel = els.knownLength.closest("label")?.querySelector('[data-i18n="label.knownLength"]');
els.knownLength.placeholder = "例: 38";

const arrowMoveLabel = document.createElement("label");
arrowMoveLabel.className = "arrow-move-label";
arrowMoveLabel.innerHTML = `
  <span data-i18n="label.arrowMoveAmount">方向キー移動量</span>
  <div class="inline-input">
    <input id="arrowMoveInput" type="number" min="0.001" step="0.1" value="${state.arrowMoveAmount}" />
    <span id="arrowMoveUnit">${els.unit.value}</span>
  </div>
`;
const arrowMoveInput = arrowMoveLabel.querySelector("#arrowMoveInput");
const arrowMoveUnit = arrowMoveLabel.querySelector("#arrowMoveUnit");
els.knownLength.closest("label")?.after(arrowMoveLabel);

calibrateModeButton.classList.add("scale-action-button");
scaleSection.appendChild(calibrateModeButton);

const applyScaleButton = document.createElement("button");
applyScaleButton.id = "applyScaleButton";
applyScaleButton.type = "button";
applyScaleButton.textContent = "距離を確定";
applyScaleButton.title = "クリックした2点間を、入力した長さとしてスケール設定します";
applyScaleButton.className = "scale-apply-button";
scaleSection.appendChild(applyScaleButton);

const areaLockButton = document.createElement("button");
areaLockButton.id = "areaLockButton";
areaLockButton.type = "button";
areaLockButton.textContent = "面積を保つ";
areaLockButton.title = "点を動かしても閉じた面の面積を保ちます";

const straightenButton = document.createElement("button");
straightenButton.id = "straightenButton";
straightenButton.type = "button";
straightenButton.textContent = "直線に戻す";
straightenButton.title = "選択したカーブを直線に戻します";

const horizontalButton = document.createElement("button");
horizontalButton.id = "horizontalButton";
horizontalButton.type = "button";
horizontalButton.textContent = "水平";
horizontalButton.title = "選択した線を水平にします";

const verticalButton = document.createElement("button");
verticalButton.id = "verticalButton";
verticalButton.type = "button";
verticalButton.textContent = "垂直";
verticalButton.title = "選択した線を垂直にします";

const traceSourceMoveButton = document.createElement("button");
traceSourceMoveButton.className = "mode-button toolbar-source-button";
traceSourceMoveButton.dataset.mode = "source";
traceSourceMoveButton.type = "button";
traceSourceMoveButton.textContent = "下敷きを動かす";
traceSourceMoveButton.title = "トレース元の画像や方眼だけをドラッグで移動します";

const sketchModeButton = document.createElement("button");
sketchModeButton.id = "sketchModeButton";
sketchModeButton.className = "mode-button toolbar-pencil-button";
sketchModeButton.dataset.mode = "sketch";
sketchModeButton.type = "button";
sketchModeButton.textContent = "✎";
sketchModeButton.title = "下書きペン";
sketchModeButton.setAttribute("aria-label", "下書きペン");

const sketchCircleButton = document.createElement("button");
sketchCircleButton.id = "sketchCircleButton";
sketchCircleButton.className = "mode-button toolbar-circle-button";
sketchCircleButton.dataset.mode = "sketch-circle";
sketchCircleButton.type = "button";
sketchCircleButton.textContent = "○";
sketchCircleButton.title = "下書き円";
sketchCircleButton.setAttribute("aria-label", "下書き円");

const clearSketchButton = document.createElement("button");
clearSketchButton.id = "clearSketchButton";
clearSketchButton.className = "toolbar-clear-sketch-button";
clearSketchButton.type = "button";
clearSketchButton.textContent = "×";
clearSketchButton.title = "下書きを消す";
clearSketchButton.setAttribute("aria-label", "下書きを消す");

const guideToggleButton = document.createElement("button");
guideToggleButton.id = "guideToggleButton";
guideToggleButton.type = "button";
guideToggleButton.textContent = "ガイド非表示";
guideToggleButton.title = "点・ラベル・ハンドルなどを隠して、図形の形だけを確認します";
guideToggleButton.className = "guide-toggle-button";

const pointLabelToggleButton = document.createElement("button");
pointLabelToggleButton.id = "pointLabelToggleButton";
pointLabelToggleButton.type = "button";
pointLabelToggleButton.textContent = "点名非表示";
pointLabelToggleButton.title = "キャンバス上のポイント番号と点名だけを表示・非表示にします";
pointLabelToggleButton.className = "guide-toggle-button";

const canvasGridToggleButton = document.createElement("button");
canvasGridToggleButton.id = "canvasGridToggleButton";
canvasGridToggleButton.type = "button";
canvasGridToggleButton.textContent = "方眼非表示";
canvasGridToggleButton.title = "キャンバス背景の方眼を表示・非表示にします";
canvasGridToggleButton.className = "guide-toggle-button";

const gridSnapToggleButton = document.createElement("button");
gridSnapToggleButton.id = "gridSnapToggleButton";
gridSnapToggleButton.type = "button";
gridSnapToggleButton.textContent = "スナップOFF";
gridSnapToggleButton.title = "点を方眼の小マスに吸着します";
gridSnapToggleButton.className = "guide-toggle-button";

const scaleReferenceToggleButton = document.createElement("button");
scaleReferenceToggleButton.id = "scaleReferenceToggleButton";
scaleReferenceToggleButton.type = "button";
scaleReferenceToggleButton.textContent = "スケール四角非表示";
scaleReferenceToggleButton.title = "左下の10cm四角だけを隠します";
scaleReferenceToggleButton.className = "guide-toggle-button";

const deleteFaceButton = document.createElement("button");
deleteFaceButton.id = "deleteFaceButton";
deleteFaceButton.type = "button";
deleteFaceButton.textContent = "図形を削除";
deleteFaceButton.title = "選択した閉じた図と、その図だけで使っている点・線を削除します";
deleteFaceButton.className = "danger-action";
const flipFaceButton = document.createElement("button");
flipFaceButton.id = "flipFaceButton";
flipFaceButton.type = "button";
flipFaceButton.textContent = "左右反転";
flipFaceButton.title = "選択した閉じた図を左右反転します";

els.connect?.remove();
els.closeShape.textContent = "閉じる";
els.closeShape.classList.add("primary-action");
const circleModeButton = document.createElement("button");
circleModeButton.id = "circleModeButton";
circleModeButton.className = "mode-button";
circleModeButton.dataset.mode = "circle";
circleModeButton.type = "button";
circleModeButton.textContent = "円を書く";

const operationSection = modeGrid.closest(".panel-section");
const connectionSection = els.closeShape.closest(".panel-section");
const coordinateSection = els.pointName.closest(".panel-section");
const rightPanel = document.querySelector(".right-panel");
const pointListSection = document.querySelector(".point-list-section");
const viewSection = document.createElement("section");
viewSection.className = "panel-section view-options-section";
operationSection.after(connectionSection);
connectionSection.after(viewSection);
coordinateSection.classList.add("coordinate-section");
const coordinateHeading = coordinateSection.querySelector("h2");
const unitLabel = els.unit.closest("label");
const coordinateHeader = document.createElement("div");
coordinateHeader.className = "coordinate-header";
unitLabel.classList.add("coordinate-unit-label");
coordinateSection.insertBefore(coordinateHeader, coordinateHeading);
coordinateHeader.append(coordinateHeading, unitLabel);
rightPanel.insertBefore(coordinateSection, pointListSection);
const edgeMeasurePanel = document.createElement("div");
edgeMeasurePanel.id = "edgeMeasurePanel";
edgeMeasurePanel.className = "edge-measure-panel";
edgeMeasurePanel.hidden = true;
edgeMeasurePanel.innerHTML = `
  <div class="edge-measure-heading">選択線</div>
  <div class="edge-measure-value" id="edgeMeasureValue">--</div>
  <div class="edge-measure-meta" id="edgeMeasureMeta">線を選択してください</div>
`;
coordinateSection.appendChild(edgeMeasurePanel);
const edgeMeasureValue = edgeMeasurePanel.querySelector("#edgeMeasureValue");
const edgeMeasureMeta = edgeMeasurePanel.querySelector("#edgeMeasureMeta");
els.imageInput.closest(".file-button").before(sketchModeButton, sketchCircleButton, clearSketchButton, traceSourceMoveButton);
els.closeShape.after(circleModeButton);

const assistDetails = document.createElement("details");
assistDetails.className = "assist-details";
assistDetails.innerHTML = `
  <summary>こまかい調整</summary>
  <div class="assist-actions"></div>
`;
els.closeShape.closest(".panel-section").appendChild(assistDetails);
const assistActions = assistDetails.querySelector(".assist-actions");
assistActions.appendChild(originModeButton);
assistActions.appendChild(areaLockButton);
assistActions.appendChild(straightenButton);
assistActions.appendChild(horizontalButton);
assistActions.appendChild(verticalButton);
assistActions.appendChild(resetButton);
assistActions.appendChild(flipFaceButton);
assistActions.appendChild(els.yUp.closest("label"));
assistActions.appendChild(deleteFaceButton);
const viewToggleRow = document.createElement("div");
viewToggleRow.className = "view-toggle-row";
viewToggleRow.append(guideToggleButton, pointLabelToggleButton);
viewSection.appendChild(viewToggleRow);
const scaleToolRow = document.createElement("div");
scaleToolRow.className = "view-toggle-row";
scaleToolRow.append(canvasGridToggleButton, scaleReferenceToggleButton, gridSnapToggleButton);
viewSection.appendChild(scaleToolRow);

const blankGridButton = document.createElement("button");
blankGridButton.id = "blankGridButton";
blankGridButton.type = "button";
blankGridButton.textContent = "方眼紙";
blankGridButton.title = "実寸確認用の方眼紙を下敷きにします";
els.sampleButton.parentElement.insertBefore(blankGridButton, els.sampleButton);

const downloadDxfButton = document.createElement("button");
downloadDxfButton.id = "downloadDxfButton";
downloadDxfButton.type = "button";
downloadDxfButton.textContent = "DXF保存";
document.querySelector(".export-grid").appendChild(downloadDxfButton);

const printPdfButton = document.createElement("button");
printPdfButton.id = "printPdfButton";
printPdfButton.type = "button";
printPdfButton.textContent = "印刷 / PDF";

const downloadMdCloPyButton = document.createElement("button");
downloadMdCloPyButton.id = "downloadMdCloPyButton";
downloadMdCloPyButton.type = "button";
downloadMdCloPyButton.textContent = "MD/CLO py保存";
document.querySelector(".export-grid").appendChild(downloadMdCloPyButton);

const downloadBlenderPyButton = document.createElement("button");
downloadBlenderPyButton.id = "downloadBlenderPyButton";
downloadBlenderPyButton.type = "button";
downloadBlenderPyButton.textContent = "Blender py保存";
document.querySelector(".export-grid").appendChild(downloadBlenderPyButton);

const importJsonInput = document.createElement("input");
importJsonInput.id = "importJsonInput";
importJsonInput.type = "file";
importJsonInput.accept = ".json,application/json";
importJsonInput.hidden = true;
document.body.appendChild(importJsonInput);

const importDxfInput = document.createElement("input");
importDxfInput.id = "importDxfInput";
importDxfInput.type = "file";
importDxfInput.accept = ".dxf,application/dxf,text/plain";
importDxfInput.hidden = true;
document.body.appendChild(importDxfInput);

const importJsonButton = document.createElement("button");
importJsonButton.id = "importJsonButton";
importJsonButton.type = "button";
importJsonButton.textContent = "JSON読込";
importJsonButton.title = "Quack TraceのJSON保存から作業状態を読み込みます";

const importDxfButton = document.createElement("button");
importDxfButton.id = "importDxfButton";
importDxfButton.type = "button";
importDxfButton.textContent = "DXF読込(実験)";
importDxfButton.title = "実験機能です。CAD由来DXFを直線化し、元DXF線をガイド表示します。";

const svgLabelsLabel = document.createElement("label");
svgLabelsLabel.className = "switch-row export-option-row";
const svgLabelsToggle = document.createElement("input");
svgLabelsToggle.id = "svgLabelsToggle";
svgLabelsToggle.type = "checkbox";
svgLabelsToggle.checked = true;
svgLabelsLabel.appendChild(svgLabelsToggle);
svgLabelsLabel.appendChild(document.createTextNode("SVGに点名を入れる"));

const dxfInternalLinesLabel = document.createElement("label");
dxfInternalLinesLabel.className = "switch-row export-option-row";
const dxfInternalLinesToggle = document.createElement("input");
dxfInternalLinesToggle.id = "dxfInternalLinesToggle";
dxfInternalLinesToggle.type = "checkbox";
dxfInternalLinesToggle.checked = false;
dxfInternalLinesLabel.appendChild(dxfInternalLinesToggle);
dxfInternalLinesLabel.appendChild(document.createTextNode("DXF内部線も読む"));

const dxfCurveFitLabel = document.createElement("label");
dxfCurveFitLabel.className = "switch-row export-option-row";
const dxfCurveFitToggle = document.createElement("input");
dxfCurveFitToggle.id = "dxfCurveFitToggle";
dxfCurveFitToggle.type = "checkbox";
dxfCurveFitToggle.checked = false;
dxfCurveFitLabel.appendChild(dxfCurveFitToggle);
dxfCurveFitLabel.appendChild(document.createTextNode("DXFをカーブ化"));

const dxfStraightenCurvesLabel = document.createElement("label");
dxfStraightenCurvesLabel.className = "switch-row export-option-row";
const dxfStraightenCurvesToggle = document.createElement("input");
dxfStraightenCurvesToggle.id = "dxfStraightenCurvesToggle";
dxfStraightenCurvesToggle.type = "checkbox";
dxfStraightenCurvesToggle.checked = true;
dxfStraightenCurvesLabel.appendChild(dxfStraightenCurvesToggle);
dxfStraightenCurvesLabel.appendChild(document.createTextNode("DXFカーブを直線化"));

const dxfKeepMarkersLabel = document.createElement("label");
dxfKeepMarkersLabel.className = "switch-row export-option-row";
const dxfKeepMarkersToggle = document.createElement("input");
dxfKeepMarkersToggle.id = "dxfKeepMarkersToggle";
dxfKeepMarkersToggle.type = "checkbox";
dxfKeepMarkersToggle.checked = true;
dxfKeepMarkersLabel.appendChild(dxfKeepMarkersToggle);
dxfKeepMarkersLabel.appendChild(document.createTextNode("DXFポイントを保持"));

const dxfOriginalGuideLabel = document.createElement("label");
dxfOriginalGuideLabel.className = "switch-row export-option-row";
const dxfOriginalGuideToggle = document.createElement("input");
dxfOriginalGuideToggle.id = "dxfOriginalGuideToggle";
dxfOriginalGuideToggle.type = "checkbox";
dxfOriginalGuideToggle.checked = true;
dxfOriginalGuideLabel.appendChild(dxfOriginalGuideToggle);
dxfOriginalGuideLabel.appendChild(document.createTextNode("元DXF線を表示"));

const importOptionsDetails = document.createElement("details");
importOptionsDetails.className = "import-options-details";
const importOptionsSummary = document.createElement("summary");
importOptionsSummary.textContent = "インポートオプション";
const importOptionsBody = document.createElement("div");
importOptionsBody.className = "import-options-body";
importOptionsBody.append(dxfInternalLinesLabel, dxfCurveFitLabel, dxfStraightenCurvesLabel, dxfKeepMarkersLabel, dxfOriginalGuideLabel);
importOptionsDetails.append(importOptionsSummary, importOptionsBody);

const exportGrid = document.querySelector(".export-grid");
const exportStatus = document.createElement("div");
exportStatus.id = "exportStatus";
exportStatus.className = "export-status";
exportGrid.parentElement.insertBefore(exportStatus, exportGrid);

const fileNameLabel = document.createElement("label");
fileNameLabel.className = "export-file-name";
fileNameLabel.textContent = "保存名";
const fileNameInput = document.createElement("input");
fileNameInput.id = "exportFileName";
fileNameInput.type = "text";
fileNameInput.placeholder = "空なら画像名で保存";
fileNameInput.autocomplete = "off";
fileNameLabel.appendChild(fileNameInput);
exportGrid.parentElement.insertBefore(fileNameLabel, exportGrid);

function appendExportCard(title, buttons, extras = []) {
  const card = document.createElement("article");
  card.className = "export-card";
  const header = document.createElement("div");
  header.className = "export-card-header";
  header.innerHTML = `<h3>${title}</h3>`;
  const actions = document.createElement("div");
  actions.className = "export-card-actions";
  buttons.forEach((button) => actions.appendChild(button));
  card.appendChild(header);
  card.appendChild(actions);
  extras.forEach((extra) => card.appendChild(extra));
  exportGrid.appendChild(card);
}

while (exportGrid.firstChild) exportGrid.removeChild(exportGrid.firstChild);
exportGrid.classList.add("export-groups");
appendExportCard("記録", [
  importJsonButton,
  els.copyJson,
  els.downloadJson,
  els.downloadCsv,
]);
appendExportCard("図面", [
  importDxfButton,
  els.downloadSvg,
  downloadDxfButton,
  printPdfButton,
], [svgLabelsLabel, importOptionsDetails]);
appendExportCard("Python", [
  downloadMdCloPyButton,
  downloadBlenderPyButton,
]);

const loupePanel = document.querySelector("#loupePanel");
document.querySelector(".right-panel").insertBefore(loupePanel, document.querySelector(".right-panel .panel-section"));

const opacityLabel = document.createElement("label");
opacityLabel.className = "compact-range-label";
opacityLabel.textContent = "画像の濃さ";
const opacityInput = document.createElement("input");
opacityInput.id = "imageOpacityInput";
opacityInput.type = "range";
opacityInput.min = "0";
opacityInput.max = "1";
opacityInput.step = "0.05";
opacityInput.value = String(state.imageOpacity);
opacityLabel.appendChild(opacityInput);
const opacityValue = document.createElement("span");
opacityValue.className = "range-readout";
opacityValue.textContent = `${Math.round(state.imageOpacity * 100)}%`;
opacityLabel.appendChild(opacityValue);

const shapeOpacityLabel = document.createElement("label");
shapeOpacityLabel.className = "compact-range-label";
shapeOpacityLabel.textContent = "図の濃さ";
const shapeOpacityInput = document.createElement("input");
shapeOpacityInput.id = "shapeOpacityInput";
shapeOpacityInput.type = "range";
shapeOpacityInput.min = "0";
shapeOpacityInput.max = "1";
shapeOpacityInput.step = "0.05";
shapeOpacityInput.value = String(state.shapeOpacity);
shapeOpacityLabel.appendChild(shapeOpacityInput);
const shapeOpacityValue = document.createElement("span");
shapeOpacityValue.className = "range-readout";
shapeOpacityValue.textContent = `${Math.round(state.shapeOpacity * 100)}%`;
shapeOpacityLabel.appendChild(shapeOpacityValue);

const gridOpacityLabel = document.createElement("label");
gridOpacityLabel.className = "compact-range-label grid-opacity-label";
gridOpacityLabel.textContent = "方眼の濃さ";
const gridOpacityInput = document.createElement("input");
gridOpacityInput.id = "gridOpacityInput";
gridOpacityInput.type = "range";
gridOpacityInput.min = "0";
gridOpacityInput.max = "1";
gridOpacityInput.step = "0.05";
gridOpacityInput.value = String(state.gridOpacity);
gridOpacityLabel.appendChild(gridOpacityInput);
const gridOpacityValue = document.createElement("span");
gridOpacityValue.className = "range-readout";
gridOpacityValue.textContent = `${Math.round(state.gridOpacity * 100)}%`;
gridOpacityLabel.appendChild(gridOpacityValue);

const pointSizeLabel = document.createElement("label");
pointSizeLabel.className = "compact-range-label";
pointSizeLabel.textContent = "点サイズ";
const pointSizeInput = document.createElement("input");
pointSizeInput.id = "pointSizeInput";
pointSizeInput.type = "range";
pointSizeInput.min = "0";
pointSizeInput.max = "1";
pointSizeInput.step = "0.05";
pointSizeInput.value = String(state.pointSize);
pointSizeLabel.appendChild(pointSizeInput);
const pointSizeValue = document.createElement("span");
pointSizeValue.className = "range-readout";
pointSizeValue.textContent = `${Math.round(state.pointSize * 100)}%`;
pointSizeLabel.appendChild(pointSizeValue);

const opacityControls = document.createElement("div");
opacityControls.className = "opacity-controls-row";
opacityControls.append(opacityLabel, shapeOpacityLabel, gridOpacityLabel, pointSizeLabel);
viewSection.appendChild(opacityControls);

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });

  setButton(els.language, "top.language");
  if (els.brandSound) {
    els.brandSound.title = t("action.playQuackReset");
    els.brandSound.setAttribute("aria-label", t("action.playQuackReset"));
  }
  setButton(els.sampleButton, "top.sample");
  els.fitButton.title = state.fitViewBefore ? t("top.fitBack") : t("top.fit");
  sketchModeButton.title = t("top.sketchTitle");
  sketchModeButton.setAttribute("aria-label", t("top.sketch"));
  sketchCircleButton.title = t("top.sketchCircleTitle");
  sketchCircleButton.setAttribute("aria-label", t("top.sketchCircle"));
  clearSketchButton.title = t("top.clearSketchTitle");
  clearSketchButton.setAttribute("aria-label", t("top.clearSketch"));
  setButton(traceSourceMoveButton, "top.source", "top.sourceTitle");
  setButton(blankGridButton, "top.grid", "top.gridTitle");

  setButton(selectModeButton, "mode.select");
  setButton(modeGrid.querySelector('[data-mode="point"]'), "mode.point");
  setButton(curveModeButton, "mode.curve");
  setButton(calibrateModeButton, "mode.calibrate");
  setButton(originModeButton, "mode.origin");
  setButton(circleModeButton, "mode.circle");

  setButton(els.closeShape, "action.close");
  setButton(resetButton, "action.reset", "action.resetTitle");
  setButton(redoButton, "action.redoTitle", "action.redoTitle");
  redoButton.textContent = "Redo";
  els.undo.textContent = "Undo";
  els.undo.title = t("action.undoTitle");
  els.undo.setAttribute("aria-label", t("action.undoTitle"));
  setButton(applyScaleButton, "action.applyScale", "action.applyScaleTitle");
  setButton(areaLockButton, "action.areaLock", "action.areaLockTitle");
  setButton(straightenButton, "action.straighten", "action.straightenTitle");
  setButton(horizontalButton, "action.horizontal", "action.horizontalTitle");
  setButton(verticalButton, "action.vertical", "action.verticalTitle");
  setButton(flipFaceButton, "action.flipFace", "action.flipFaceTitle");
  setButton(deleteFaceButton, "action.deleteFace", "action.deleteFaceTitle");

  guideToggleButton.textContent = state.showGuides ? t("action.hideGuides") : t("action.showGuides");
  pointLabelToggleButton.textContent = state.showPointLabels ? t("action.hidePointLabels") : t("action.showPointLabels");
  pointLabelToggleButton.title = t("action.pointLabelsTitle");
  canvasGridToggleButton.textContent = state.showCanvasGrid ? t("action.hideCanvasGrid") : t("action.showCanvasGrid");
  gridSnapToggleButton.textContent = state.snapToGrid ? t("action.snapOn") : t("action.snapOff");
  gridSnapToggleButton.title = t("action.snapTitle");
  scaleReferenceToggleButton.textContent = state.showScaleReference ? t("action.hideScaleReference") : t("action.showScaleReference");
  guideToggleButton.classList.toggle("active", !state.showGuides);
  pointLabelToggleButton.classList.toggle("active", !state.showPointLabels);
  canvasGridToggleButton.classList.toggle("active", !state.showCanvasGrid);
  gridSnapToggleButton.classList.toggle("active", state.snapToGrid);
  scaleReferenceToggleButton.classList.toggle("active", !state.showScaleReference);
  assistDetails.querySelector("summary").textContent = t("action.details");
  edgeMeasurePanel.querySelector(".edge-measure-heading").textContent = t("edge.heading");
  if (!edgeMeasurePanel.hidden && edgeMeasureMeta.textContent === I18N.ja["edge.none"]) {
    edgeMeasureMeta.textContent = t("edge.none");
  }

  setButton(importJsonButton, "export.importJson", "export.importJsonTitle");
  setButton(importDxfButton, "export.importDxf", "export.importDxfTitle");
  setButton(els.copyJson, "export.copyJson");
  setButton(els.downloadJson, "export.saveJson");
  setButton(els.downloadCsv, "export.saveCsv");
  setButton(els.downloadSvg, "export.saveSvg");
  setButton(downloadDxfButton, "export.saveDxf");
  setButton(printPdfButton, "export.printPdf", "export.printPdfTitle");
  setButton(downloadMdCloPyButton, "export.saveMdClo");
  setButton(downloadBlenderPyButton, "export.saveBlender");
  svgLabelsLabel.lastChild.textContent = t("label.svgNames");
  importOptionsSummary.textContent = t("label.importOptions");
  dxfInternalLinesLabel.lastChild.textContent = t("label.dxfInternalLines");
  dxfCurveFitLabel.lastChild.textContent = t("label.dxfCurveFit");
  dxfStraightenCurvesLabel.lastChild.textContent = t("label.dxfStraightenCurves");
  dxfKeepMarkersLabel.lastChild.textContent = t("label.dxfKeepMarkers");
  dxfOriginalGuideLabel.lastChild.textContent = t("label.dxfOriginalGuide");
  fileNameLabel.firstChild.textContent = t("label.fileName");
  fileNameInput.placeholder = t("label.fileNamePlaceholder");
  opacityLabel.firstChild.textContent = t("label.imageOpacity");
  shapeOpacityLabel.firstChild.textContent = t("label.shapeOpacity");
  gridOpacityLabel.firstChild.textContent = t("label.gridOpacity");
  pointSizeLabel.firstChild.textContent = t("label.pointSize");
  if (knownLengthLabel) knownLengthLabel.textContent = t("label.knownLength");
  els.knownLength.placeholder = state.language === "en" ? "e.g. 38" : "例: 38";
  arrowMoveInput.placeholder = state.language === "en" ? "e.g. 1" : "例: 1";
  if (duckCalculator.trigger) {
    duckCalculator.trigger.title = t("calculator.title");
    duckCalculator.trigger.setAttribute("aria-label", t("calculator.title"));
  }
  if (duckCalculator.panel) {
    duckCalculator.panel.setAttribute("aria-label", t("calculator.title"));
  }
  if (duckCalculator.input) {
    duckCalculator.input.placeholder = t("calculator.placeholder");
  }
  const calculatorBackspace = duckCalculator.panel?.querySelector('[data-calc-key="Back"]');
  if (calculatorBackspace) {
    calculatorBackspace.title = t("calculator.backspace");
    calculatorBackspace.setAttribute("aria-label", t("calculator.backspace"));
  }
  const calculatorClear = duckCalculator.panel?.querySelector('[data-calc-key="C"]');
  if (calculatorClear) {
    calculatorClear.title = t("calculator.clear");
    calculatorClear.setAttribute("aria-label", t("calculator.clear"));
  }

  document.querySelectorAll(".export-card-header h3").forEach((heading) => {
    if (heading.textContent === I18N.ja["section.record"] || heading.textContent === I18N.en["section.record"]) heading.textContent = t("section.record");
    if (heading.textContent === I18N.ja["section.drawing"] || heading.textContent === I18N.en["section.drawing"]) heading.textContent = t("section.drawing");
    if (heading.textContent === I18N.ja["section.python"] || heading.textContent === I18N.en["section.python"]) heading.textContent = t("section.python");
  });

  updateScaleReadout();
  updateExportReadiness();
  updateCoach();
  updateFitButton();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function canvasCssSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function screenToImage(screenX, screenY) {
  return {
    x: (screenX - state.view.x) / state.view.zoom,
    y: (screenY - state.view.y) / state.view.zoom,
  };
}

function imageToScreen(imageX, imageY) {
  return {
    x: state.view.x + imageX * state.view.zoom,
    y: state.view.y + imageY * state.view.zoom,
  };
}

function sourceImageRect() {
  if (!state.image) return { x: state.sourceOffset.x, y: state.sourceOffset.y, width: 0, height: 0 };
  return {
    x: state.sourceOffset.x,
    y: state.sourceOffset.y,
    width: state.image.width * state.sourceScale,
    height: state.image.height * state.sourceScale,
  };
}

function scaleSourceUnderlayAt(screenPoint, factor) {
  if (!state.image) return false;
  const worldPoint = screenToImage(screenPoint.x, screenPoint.y);
  const currentScale = state.sourceScale || 1;
  const nextScale = Math.min(MAX_SOURCE_SCALE, Math.max(MIN_SOURCE_SCALE, currentScale * factor));
  if (Math.abs(nextScale - currentScale) < 0.0001) return false;
  const sourcePoint = {
    x: (worldPoint.x - state.sourceOffset.x) / currentScale,
    y: (worldPoint.y - state.sourceOffset.y) / currentScale,
  };
  state.sourceScale = nextScale;
  state.sourceOffset = {
    x: worldPoint.x - sourcePoint.x * nextScale,
    y: worldPoint.y - sourcePoint.y * nextScale,
  };
  return true;
}

function snapGridStepImagePx() {
  if (state.cmPerPixel) return 1 / state.cmPerPixel;
  return GRID_PAPER_MINOR_PX;
}

function snapGridOriginImagePoint() {
  return state.origin || { x: 0, y: 0 };
}

function snapImagePointToGrid(point) {
  if (!state.snapToGrid) return point;
  const step = snapGridStepImagePx();
  if (!Number.isFinite(step) || step <= 0) return point;
  const origin = snapGridOriginImagePoint();
  return {
    x: origin.x + Math.round((point.x - origin.x) / step) * step,
    y: origin.y + Math.round((point.y - origin.y) / step) * step,
  };
}

function sketchImagePoint(point) {
  return state.snapToGrid ? snapImagePointToGrid(point) : point;
}

function resetCanvasGridBackground() {
  if (!canvasPanel) return;
  canvasPanel.style.removeProperty("--canvas-grid-minor");
  canvasPanel.style.removeProperty("--canvas-grid-major");
  canvasPanel.style.removeProperty("--canvas-grid-origin");
}

function updateCanvasGridOpacity() {
  if (!canvasPanel) return;
  const intensity = Math.min(1, Math.max(0, state.gridOpacity));
  canvasPanel.style.setProperty("--canvas-grid-minor-alpha", String(Math.min(1, 0.12 * intensity)));
  canvasPanel.style.setProperty("--canvas-grid-major-alpha", String(Math.min(1, 0.22 * intensity)));
}

function updateCanvasGridBackground() {
  if (!canvasPanel) return;
  updateCanvasGridOpacity();
  canvasPanel.classList.toggle("canvas-grid-hidden", !state.showCanvasGrid);
  if (!state.showCanvasGrid) {
    resetCanvasGridBackground();
    return;
  }
  if (!state.origin || !state.image) {
    resetCanvasGridBackground();
    return;
  }

  const snapOrigin = snapGridOriginImagePoint();
  const origin = imageToScreen(snapOrigin.x, snapOrigin.y);
  const minorSize = Math.max(2, snapGridStepImagePx() * state.view.zoom);
  const majorSize = Math.max(minorSize, minorSize * 5);
  canvasPanel.style.setProperty("--canvas-grid-minor", `${minorSize}px`);
  canvasPanel.style.setProperty("--canvas-grid-major", `${majorSize}px`);
  canvasPanel.style.setProperty("--canvas-grid-origin", `${origin.x}px ${origin.y}px`);
}

function hitTestPoint(screenX, screenY) {
  for (let index = state.points.length - 1; index >= 0; index -= 1) {
    const point = state.points[index];
    const screen = imageToScreen(point.x, point.y);
    if (Math.hypot(screen.x - screenX, screen.y - screenY) <= POINT_HIT_RADIUS) {
      return point;
    }
  }
  return null;
}

function hitTestSelectedPoint(screenX, screenY) {
  if (state.selected.size === 0) return null;
  let closest = null;
  let closestDistance = Infinity;
  state.points.forEach((point) => {
    if (!state.selected.has(point.id)) return;
    const screen = imageToScreen(point.x, point.y);
    const distance = Math.hypot(screen.x - screenX, screen.y - screenY);
    if (distance <= POINT_HIT_RADIUS && distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  });
  return closest;
}

function selectedPointScreenBounds(padding = 0) {
  const selectedPoints = state.points.filter((point) => state.selected.has(point.id));
  if (selectedPoints.length < 2) return null;
  const screens = selectedPoints.map((point) => imageToScreen(point.x, point.y));
  return {
    minX: Math.min(...screens.map((point) => point.x)) - padding,
    minY: Math.min(...screens.map((point) => point.y)) - padding,
    maxX: Math.max(...screens.map((point) => point.x)) + padding,
    maxY: Math.max(...screens.map((point) => point.y)) + padding,
  };
}

function pointInsideBox(point, box) {
  return Boolean(box)
    && point.x >= box.minX
    && point.x <= box.maxX
    && point.y >= box.minY
    && point.y <= box.maxY;
}

function screenBoxFromDrag(drag) {
  const endX = Number.isFinite(drag.currentX) ? drag.currentX : drag.startX;
  const endY = Number.isFinite(drag.currentY) ? drag.currentY : drag.startY;
  return {
    minX: Math.min(drag.startX, endX),
    minY: Math.min(drag.startY, endY),
    maxX: Math.max(drag.startX, endX),
    maxY: Math.max(drag.startY, endY),
  };
}

function pointIsInsideScreenBox(point, box) {
  const screen = imageToScreen(point.x, point.y);
  return screen.x >= box.minX
    && screen.x <= box.maxX
    && screen.y >= box.minY
    && screen.y <= box.maxY;
}

function applyBoxSelection(drag) {
  const box = screenBoxFromDrag(drag);
  const selectedIds = state.points
    .filter((point) => pointIsInsideScreenBox(point, box))
    .map((point) => point.id);
  if (!drag.additive) {
    state.selected.clear();
  }
  selectedIds.forEach((id) => state.selected.add(id));
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  const selectedFace = selectedFaceTarget();
  if (selectedFace && selectedFace.face.every((id) => state.selected.has(id))) {
    state.selectedFaceIndex = selectedFace.index;
  }
  const count = selectedIds.length;
  setStatus(state.language === "en"
    ? `Selected ${count} point${count === 1 ? "" : "s"} with the box.`
    : `範囲選択で${count}点を選択しました。`);
  updateAll();
}

function appendSketchPoint(stroke, point) {
  const previous = stroke.points[stroke.points.length - 1];
  if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) * state.view.zoom < 1.5) return false;
  stroke.points.push(point);
  return true;
}

function edgeControl(edge) {
  return edge[2] || null;
}

function shiftedEdgeControl(control, dx, dy) {
  if (!control) return null;
  const shifted = structuredClone(control);
  if (shifted.c1 && shifted.c2) {
    shifted.c1.x += dx;
    shifted.c1.y += dy;
    shifted.c2.x += dx;
    shifted.c2.y += dy;
    return shifted;
  }
  if (typeof shifted.x === "number" && typeof shifted.y === "number") {
    shifted.x += dx;
    shifted.y += dy;
  }
  return shifted;
}

function edgeControlSnapshotsForMovingPoints(pointIds) {
  const movingIds = new Set(pointIds);
  return state.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => movingIds.has(edge[0]) && movingIds.has(edge[1]) && edgeControl(edge))
    .map(({ edge, index }) => ({
      index,
      control: structuredClone(edgeControl(edge)),
    }));
}

function snapshotTrace() {
  return {
    view: structuredClone(state.view),
    sourceOffset: structuredClone(state.sourceOffset),
    sourceScale: state.sourceScale,
    sketchStrokes: structuredClone(state.sketchStrokes),
    sketchCircles: structuredClone(state.sketchCircles),
    points: structuredClone(state.points),
    edges: structuredClone(state.edges),
    faces: structuredClone(state.faces),
    currentPathLast: state.currentPathLast,
    currentPathIds: structuredClone(state.currentPathIds),
    selectedEdgeIndex: state.selectedEdgeIndex,
    selectedEdgeIndices: [...state.selectedEdgeIndices],
    selectedCurveHandle: state.selectedCurveHandle ? structuredClone(state.selectedCurveHandle) : null,
    selectedFaceIndex: state.selectedFaceIndex,
    selected: [...state.selected],
    calibrationClicks: structuredClone(state.calibrationClicks),
    cmPerPixel: state.cmPerPixel,
    origin: state.origin ? structuredClone(state.origin) : null,
    lastPointClick: state.lastPointClick ? structuredClone(state.lastPointClick) : null,
    pointName: els.pointName.value,
  };
}

function restoreTrace(snapshot) {
  if (snapshot.view) state.view = structuredClone(snapshot.view);
  state.sourceOffset = structuredClone(snapshot.sourceOffset || { x: 0, y: 0 });
  state.sourceScale = Math.min(MAX_SOURCE_SCALE, Math.max(MIN_SOURCE_SCALE, finiteNumber(snapshot.sourceScale) || 1));
  state.sketchStrokes = structuredClone(snapshot.sketchStrokes || []);
  state.sketchCircles = structuredClone(snapshot.sketchCircles || []);
  state.points = structuredClone(snapshot.points);
  state.edges = structuredClone(snapshot.edges);
  state.faces = structuredClone(snapshot.faces);
  ensureFaceBoundaryEdges();
  state.currentPathLast = snapshot.currentPathLast;
  state.currentPathIds = structuredClone(snapshot.currentPathIds || []);
  state.selectedEdgeIndex = snapshot.selectedEdgeIndex ?? null;
  state.selectedEdgeIndices = new Set(snapshot.selectedEdgeIndices || []);
  if (state.selectedEdgeIndices.size === 0 && state.selectedEdgeIndex !== null) {
    state.selectedEdgeIndices.add(state.selectedEdgeIndex);
  }
  state.selectedCurveHandle = snapshot.selectedCurveHandle ? structuredClone(snapshot.selectedCurveHandle) : null;
  state.selectedFaceIndex = snapshot.selectedFaceIndex ?? null;
  state.selected = new Set(snapshot.selected || []);
  state.calibrationClicks = structuredClone(snapshot.calibrationClicks || []);
  state.cmPerPixel = snapshot.cmPerPixel;
  state.origin = snapshot.origin ? structuredClone(snapshot.origin) : null;
  state.lastPointClick = snapshot.lastPointClick ? structuredClone(snapshot.lastPointClick) : null;
  if (snapshot.pointName) els.pointName.value = snapshot.pointName;
  updateAll();
}

const HISTORY_LIMIT = 80;

function pushBoundedHistory(stack, snapshot) {
  stack.push(snapshot);
  if (stack.length > HISTORY_LIMIT) stack.shift();
}

function pushHistory(snapshot = snapshotTrace()) {
  pushBoundedHistory(state.undoStack, snapshot);
  state.redoStack = [];
  updateUndoButton();
}

function undoTrace() {
  const snapshot = state.undoStack.pop();
  if (!snapshot) {
    setStatus("戻れる作図操作がありません。");
    return;
  }
  pushBoundedHistory(state.redoStack, snapshotTrace());
  restoreTrace(snapshot);
  updateUndoButton();
  setStatus("1つ戻しました。");
}

function redoTrace() {
  const snapshot = state.redoStack.pop();
  if (!snapshot) {
    setStatus("やり直せる作図操作がありません。");
    return;
  }
  pushBoundedHistory(state.undoStack, snapshotTrace());
  restoreTrace(snapshot);
  updateUndoButton();
  setStatus("1つやり直しました。");
}

function clearUndoHistory() {
  state.undoStack = [];
  state.redoStack = [];
  updateUndoButton();
}

function updateUndoButton() {
  if (els.undo) els.undo.disabled = state.undoStack.length === 0;
  if (els.redo) els.redo.disabled = state.redoStack.length === 0;
}

function hasTraceContent() {
  return (
    state.points.length > 0
    || state.edges.length > 0
    || state.faces.length > 0
    || state.sketchStrokes.length > 0
    || state.sketchCircles.length > 0
    || state.calibrationClicks.length > 0
  );
}

function cubicPoint(a, c1, c2, b, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * a.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * b.x,
    y: mt * mt * mt * a.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * b.y,
  };
}

function edgeCubicControls(edge) {
  const control = edgeControl(edge || []);
  if (!control) return null;
  if (control.c1 && control.c2) return control;

  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to || control.x === undefined || control.y === undefined) return null;
  return {
    c1: {
      x: from.x + (2 / 3) * (control.x - from.x),
      y: from.y + (2 / 3) * (control.y - from.y),
    },
    c2: {
      x: to.x + (2 / 3) * (control.x - to.x),
      y: to.y + (2 / 3) * (control.y - to.y),
    },
  };
}

function initializeEdgeControls(edge, imagePoint) {
  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const offset = { x: imagePoint.x - mid.x, y: imagePoint.y - mid.y };
  edge[2] = {
    c1: {
      x: from.x + (to.x - from.x) / 3 + offset.x,
      y: from.y + (to.y - from.y) / 3 + offset.y,
    },
    c2: {
      x: from.x + (to.x - from.x) * 2 / 3 + offset.x,
      y: from.y + (to.y - from.y) * 2 / 3 + offset.y,
    },
  };
}

function findEdgeBetween(fromId, toId) {
  return state.edges.find((edge) => (
    (edge[0] === fromId && edge[1] === toId) || (edge[0] === toId && edge[1] === fromId)
  )) || null;
}

function findEdgeIndexBetween(fromId, toId) {
  return state.edges.findIndex((edge) => (
    (edge[0] === fromId && edge[1] === toId) || (edge[0] === toId && edge[1] === fromId)
  ));
}

function ensureFaceBoundaryEdges() {
  const existingPointIds = new Set(state.points.map((point) => point.id));
  state.faces = state.faces
    .map((face) => face.filter((id) => existingPointIds.has(id)))
    .filter((face) => face.length >= 3);

  state.faces.forEach((face) => {
    face.forEach((fromId, index) => {
      const toId = face[(index + 1) % face.length];
      if (!findEdgeBetween(fromId, toId)) state.edges.push([fromId, toId]);
    });
  });
}

function faceBoundaryPairKeys() {
  const keys = new Set();
  state.faces.forEach((face) => {
    face.forEach((fromId, index) => {
      const toId = face[(index + 1) % face.length];
      keys.add([fromId, toId].sort().join("|"));
    });
  });
  return keys;
}

function edgePairKey(edge) {
  return [edge[0], edge[1]].sort().join("|");
}

function isFaceBoundaryEdge(edge) {
  return faceBoundaryPairKeys().has(edgePairKey(edge));
}

function directedEdgeControls(edge, fromId, toId, controlsOverride = null) {
  const controls = controlsOverride || edgeCubicControls(edge || []);
  if (!edge || !controls) return null;
  if (edge[0] === fromId && edge[1] === toId) return controls;
  return { c1: controls.c2, c2: controls.c1 };
}

function edgeControlForDirection(fromId, toId) {
  const edge = findEdgeBetween(fromId, toId);
  return directedEdgeControls(edge, fromId, toId);
}

function sampleEdgeImagePoints(from, to, edge, curveSteps = 24, controlsOverride = null) {
  const controls = controlsOverride || edgeCubicControls(edge || []);
  if (!controls) return [from];

  const samples = [];
  for (let step = 0; step < curveSteps; step += 1) {
    samples.push(cubicPoint(from, controls.c1, controls.c2, to, step / curveSteps));
  }
  return samples;
}

function edgeLengthPixels(edge, curveSteps = 64) {
  if (!edge) return null;
  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return null;

  const controls = edgeCubicControls(edge);
  const samples = controls
    ? [...sampleEdgeImagePoints(from, to, edge, curveSteps, controls), to]
    : [from, to];

  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += Math.hypot(
      samples[index].x - samples[index - 1].x,
      samples[index].y - samples[index - 1].y
    );
  }
  return length;
}

function edgeLengthPattern(edge) {
  const pixels = edgeLengthPixels(edge);
  if (pixels === null) return null;
  if (!state.cmPerPixel) return { value: pixels, unit: "px" };

  const cm = pixels * state.cmPerPixel;
  if (els.unit.value === "mm") return { value: cm * 10, unit: "mm" };
  return { value: cm, unit: "cm" };
}

function formatLengthValue(value, unit) {
  if (value === null || Number.isNaN(value)) return "--";
  if (unit === "px") return `${value.toFixed(1)} px`;
  if (value >= 100) return `${value.toFixed(1)} ${unit}`;
  if (value >= 10) return `${value.toFixed(2)} ${unit}`;
  return `${value.toFixed(3)} ${unit}`;
}

function formatSelectedEdgeLength(edge) {
  const length = edgeLengthPattern(edge);
  if (!length) return "--";
  return formatLengthValue(length.value, length.unit);
}

function selectedEdgeIndexList() {
  const indices = state.selectedEdgeIndices instanceof Set ? [...state.selectedEdgeIndices] : [];
  if (indices.length === 0 && state.selectedEdgeIndex !== null) indices.push(state.selectedEdgeIndex);
  return indices.filter((index) => Number.isInteger(index) && state.edges[index]);
}

function setSingleSelectedEdge(index) {
  if (Number.isInteger(index)) {
    if (state.selectedEdgeIndex !== index) state.selectedCurveHandle = null;
    state.selectedEdgeIndex = index;
    state.selectedEdgeIndices = new Set([index]);
  } else {
    state.selectedEdgeIndex = null;
    state.selectedEdgeIndices = new Set();
    state.selectedCurveHandle = null;
  }
}

function clearSelectedEdges() {
  setSingleSelectedEdge(null);
}

function updatePrimarySelectedEdge() {
  const [first] = selectedEdgeIndexList();
  state.selectedEdgeIndex = Number.isInteger(first) ? first : null;
}

function selectedEdgeLengthSummary() {
  const lengths = selectedEdgeIndexList()
    .map((index) => edgeLengthPattern(state.edges[index]))
    .filter(Boolean);
  if (lengths.length === 0) return "--";

  const unit = lengths[0].unit;
  const total = lengths.reduce((sum, length) => sum + length.value, 0);
  return lengths.length === 1
    ? `長さ ${formatLengthValue(total, unit)}`
    : `${lengths.length}本の合計 ${formatLengthValue(total, unit)}`;
}

function toggleSelectedEdge(index) {
  if (!(state.selectedEdgeIndices instanceof Set)) state.selectedEdgeIndices = new Set();
  state.selectedCurveHandle = null;
  if (state.selectedEdgeIndices.has(index)) {
    state.selectedEdgeIndices.delete(index);
    updatePrimarySelectedEdge();
  } else {
    state.selectedEdgeIndices.add(index);
    state.selectedEdgeIndex = index;
  }
}

function setSelectedCurveHandle(edgeIndex, handle) {
  if (!Number.isInteger(edgeIndex) || (handle !== "c1" && handle !== "c2")) {
    state.selectedCurveHandle = null;
    return;
  }
  setSingleSelectedEdge(edgeIndex);
  state.selectedCurveHandle = { edgeIndex, handle };
}

function selectedCurveHandleTarget() {
  const target = state.selectedCurveHandle;
  if (!target || !Number.isInteger(target.edgeIndex)) return null;
  const edge = state.edges[target.edgeIndex];
  const controls = edgeCubicControls(edge || []);
  if (!edge || !controls || (target.handle !== "c1" && target.handle !== "c2")) return null;
  return { edge, controls, edgeIndex: target.edgeIndex, handle: target.handle };
}

function moveSelectedCurveHandle(dx, dy) {
  const target = selectedCurveHandleTarget();
  if (!target) return false;
  const nextControls = structuredClone(target.controls);
  nextControls[target.handle] = {
    x: nextControls[target.handle].x + dx,
    y: nextControls[target.handle].y + dy,
  };
  target.edge[2] = constrainCurveControlsToArea(
    target.edgeIndex,
    nextControls,
    state.areaLock ? getAreaLockCurveConstraint(target.edgeIndex) : null,
    target.handle,
  );
  return true;
}

function announceSelectedEdges() {
  const count = selectedEdgeIndexList().length;
  if (count === 0) {
    setStatus("線の選択を解除しました。");
  } else if (count === 1) {
    const edge = state.edges[selectedEdgeIndexList()[0]];
    const handleHint = edgeCubicControls(edge || [])
      ? "ハンドルをクリックすると、方向キーでカーブを微調整できます。"
      : "水平・垂直や直線戻しが使えます。";
    setStatus(`線を選択しました。${selectedEdgeLengthSummary()}。${handleHint}`);
  } else {
    setStatus(`線を${count}本選択しました。${selectedEdgeLengthSummary()}。Shiftクリックで何本でも追加・解除できます。`);
  }
}

function updateSelectedEdgeMeasure() {
  const indices = selectedEdgeIndexList();
  if (indices.length === 0) {
    edgeMeasurePanel.hidden = true;
    return;
  }

  if (indices.length > 1) {
    const lengths = indices
      .map((index) => edgeLengthPattern(state.edges[index]))
      .filter(Boolean);
    if (lengths.length === 0) {
      edgeMeasurePanel.hidden = true;
      return;
    }

    const unit = lengths[0].unit;
    const total = lengths.reduce((sum, length) => sum + length.value, 0);
    edgeMeasurePanel.hidden = false;
    edgeMeasureValue.textContent = formatLengthValue(total, unit);
    edgeMeasureMeta.textContent = `${lengths.length}本の合計 / Shiftクリックで追加・解除`;
    return;
  }

  const edge = state.edges[indices[0]];
  const from = edge ? findPointById(edge[0]) : null;
  const to = edge ? findPointById(edge[1]) : null;
  const length = edge ? edgeLengthPattern(edge) : null;

  if (!edge || !from || !to || !length) {
    edgeMeasurePanel.hidden = true;
    return;
  }

  edgeMeasurePanel.hidden = false;
  edgeMeasureValue.textContent = formatLengthValue(length.value, length.unit);
  edgeMeasureMeta.textContent = `${from.name} - ${to.name} / ${edgeCubicControls(edge) ? "カーブ" : "直線"}`;
}

function updateDragPreview() {
  updateSelectedEdgeMeasure();
  draw();
}

function faceOutlineImagePoints(face, overrides = null) {
  const outline = [];
  face.forEach((fromId, index) => {
    const toId = face[(index + 1) % face.length];
    const pointOverrides = overrides instanceof Map ? overrides : overrides?.points;
    const edgeControlOverrides = overrides instanceof Map ? null : overrides?.edgeControls;
    const from = pointOverrides?.get(fromId) || findPointById(fromId);
    const to = pointOverrides?.get(toId) || findPointById(toId);
    if (!from || !to) return;
    const edgeIndex = findEdgeIndexBetween(fromId, toId);
    const edge = edgeIndex >= 0 ? state.edges[edgeIndex] : null;
    const controls = directedEdgeControls(edge, fromId, toId, edgeControlOverrides?.get(edgeIndex));
    outline.push(...sampleEdgeImagePoints(from, to, edge, 24, controls));
  });
  return outline;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function hitTestFace(imagePoint) {
  for (let index = state.faces.length - 1; index >= 0; index -= 1) {
    const outline = faceOutlineImagePoints(state.faces[index]);
    if (outline.length >= 3 && pointInPolygon(imagePoint, outline)) {
      return { index, face: state.faces[index] };
    }
  }
  return null;
}

function findPointById(id) {
  return state.points.find((point) => point.id === id) || null;
}

function distanceToSegment(point, a, b) {
  return nearestPointOnSegment(point, a, b).distance;
}

function nearestPointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return {
      point: { x: a.x, y: a.y },
      t: 0,
      distance: Math.hypot(point.x - a.x, point.y - a.y),
    };
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const projection = { x: a.x + dx * t, y: a.y + dy * t };
  return {
    point: projection,
    t,
    distance: Math.hypot(point.x - projection.x, point.y - projection.y),
  };
}

function quadraticPoint(a, c, b, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
  };
}

function distanceToQuadratic(point, a, c, b) {
  let best = Infinity;
  let previous = a;
  for (let step = 1; step <= 24; step += 1) {
    const current = quadraticPoint(a, c, b, step / 24);
    best = Math.min(best, distanceToSegment(point, previous, current));
    previous = current;
  }
  return best;
}

function distanceToCubic(point, a, c1, c2, b) {
  return nearestPointOnCubic(point, a, c1, c2, b).distance;
}

function nearestPointOnCubic(point, a, c1, c2, b, steps = 48) {
  let best = Infinity;
  let bestHit = { point: a, t: 0, distance: Math.hypot(point.x - a.x, point.y - a.y) };
  let previous = { point: a, t: 0 };
  for (let step = 1; step <= steps; step += 1) {
    const currentT = step / steps;
    const current = cubicPoint(a, c1, c2, b, currentT);
    const segmentHit = nearestPointOnSegment(point, previous.point, current);
    const t = previous.t + (currentT - previous.t) * segmentHit.t;
    if (segmentHit.distance < best) {
      best = segmentHit.distance;
      bestHit = { point: segmentHit.point, t, distance: segmentHit.distance };
    }
    previous = { point: current, t: currentT };
  }
  return bestHit;
}

function hitTestEdge(screenX, screenY) {
  const screenPoint = { x: screenX, y: screenY };
  let best = null;
  state.edges.forEach((edge, index) => {
    const from = findPointById(edge[0]);
    const to = findPointById(edge[1]);
    if (!from || !to) return;
    const a = imageToScreen(from.x, from.y);
    const b = imageToScreen(to.x, to.y);
    const controls = edgeCubicControls(edge);
    const hit = controls
      ? nearestPointOnCubic(
        screenPoint,
        a,
        imageToScreen(controls.c1.x, controls.c1.y),
        imageToScreen(controls.c2.x, controls.c2.y),
        b,
      )
      : nearestPointOnSegment(screenPoint, a, b);
    if (hit.distance <= 24 && (!best || hit.distance < best.distance)) {
      const imagePoint = screenToImage(hit.point.x, hit.point.y);
      best = { edge, index, distance: hit.distance, imagePoint, t: hit.t };
    }
  });
  return best;
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function splitCubicControls(from, controls, to, t) {
  const p01 = lerpPoint(from, controls.c1, t);
  const p12 = lerpPoint(controls.c1, controls.c2, t);
  const p23 = lerpPoint(controls.c2, to, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const point = lerpPoint(p012, p123, t);
  return {
    point,
    first: { c1: p01, c2: p012 },
    second: { c1: p123, c2: p23 },
  };
}

function insertPointInFaces(fromId, toId, newId) {
  state.faces = state.faces.map((face) => {
    const updated = [];
    face.forEach((id, index) => {
      const nextId = face[(index + 1) % face.length];
      updated.push(id);
      const matchesForward = id === fromId && nextId === toId;
      const matchesReverse = id === toId && nextId === fromId;
      if (matchesForward || matchesReverse) updated.push(newId);
    });
    return updated;
  });
}

function insertPointOnEdge(edgeHit) {
  const edge = state.edges[edgeHit.index];
  if (!edge) return false;
  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return false;

  const t = Math.max(0.02, Math.min(0.98, edgeHit.t ?? 0.5));
  const controls = edgeCubicControls(edge);
  const point = {
    id: crypto.randomUUID(),
    name: nextPointName(),
    x: edgeHit.imagePoint.x,
    y: edgeHit.imagePoint.y,
  };
  const firstEdge = [edge[0], point.id];
  const secondEdge = [point.id, edge[1]];

  if (controls) {
    const split = splitCubicControls(from, controls, to, t);
    point.x = split.point.x;
    point.y = split.point.y;
    firstEdge[2] = split.first;
    secondEdge[2] = split.second;
  }

  pushHistory();
  state.points.push(point);
  state.edges.splice(edgeHit.index, 1, firstEdge, secondEdge);
  insertPointInFaces(edge[0], edge[1], point.id);
  state.selected.clear();
  state.selected.add(point.id);
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  state.currentPathLast = null;
  state.currentPathIds = [];
  updateAll();
  setStatus(`${point.name}を線上に追加しました。`);
  return true;
}

function hitTestCurveHandle(screenX, screenY) {
  if (state.selectedEdgeIndex === null) return null;
  const edge = state.edges[state.selectedEdgeIndex];
  const controls = edgeCubicControls(edge || []);
  if (!controls) return null;
  const handles = [
    { key: "c1", point: controls.c1 },
    { key: "c2", point: controls.c2 },
  ];
  for (const handle of handles) {
    const screen = imageToScreen(handle.point.x, handle.point.y);
    if (Math.hypot(screen.x - screenX, screen.y - screenY) <= 18) {
      return { edge, index: state.selectedEdgeIndex, handle: handle.key, control: handle.point };
    }
  }
  return null;
}

function shouldCloseByRepeatedClick(point, screenPoint) {
  if (point.id !== state.currentPathLast || state.currentPathIds.length < 3) return false;

  const now = performance.now();
  const previous = state.lastPointClick;
  state.lastPointClick = {
    id: point.id,
    time: now,
    x: screenPoint.x,
    y: screenPoint.y,
  };

  if (!previous || previous.id !== point.id) return false;
  const elapsed = now - previous.time;
  const distance = Math.hypot(screenPoint.x - previous.x, screenPoint.y - previous.y);
  return elapsed <= CLOSE_DOUBLE_CLICK_MS && distance <= POINT_HIT_RADIUS * 1.6;
}

function unitFactor() {
  return els.unit.value === "mm" ? 10 : 1;
}

function pointToPattern(point) {
  const origin = state.origin || { x: 0, y: 0 };
  const scale = state.cmPerPixel || 1;
  const factor = unitFactor();
  const x = (point.x - origin.x) * scale * factor;
  const rawY = (point.y - origin.y) * scale * factor;
  return {
    x: roundCoord(x),
    y: roundCoord(state.yUp ? -rawY : rawY),
  };
}

function imagePointToPatternCoords(point) {
  const origin = state.origin || { x: 0, y: 0 };
  const scale = state.cmPerPixel || 1;
  const factor = unitFactor();
  const x = roundCoord((point.x - origin.x) * scale * factor);
  const rawY = (point.y - origin.y) * scale * factor;
  return {
    x,
    y: roundCoord(state.yUp ? -rawY : rawY),
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function patternCoordsToImagePoint(point, unit, cmPerPixel, origin, yUp) {
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  if (x === null || y === null || !cmPerPixel) return null;
  const factor = unit === "mm" ? 10 : 1;
  return {
    x: origin.x + x / (cmPerPixel * factor),
    y: origin.y + (yUp ? -y : y) / (cmPerPixel * factor),
  };
}

function areaLockFallbackDirection(face, index) {
  const previous = state.points.find((point) => point.id === face[(index - 1 + face.length) % face.length]);
  const next = state.points.find((point) => point.id === face[(index + 1) % face.length]);
  if (!previous || !next) return null;
  return normalizeVector({ x: next.x - previous.x, y: next.y - previous.y });
}

function areaLockTangentDirection(pointId, face, origin, area) {
  if (!origin || !Number.isFinite(area)) return null;
  const baseStep = Math.sqrt(Math.max(area, 1)) * 0.01;
  const step = Math.max(0.25, Math.min(12, baseStep));
  const constraint = { pointId, face };
  const areaAt = (dx, dy) => areaWithPointOverride(constraint, {
    x: origin.x + dx,
    y: origin.y + dy,
  });
  const gx = (areaAt(step, 0) - areaAt(-step, 0)) / (step * 2);
  const gy = (areaAt(0, step) - areaAt(0, -step)) / (step * 2);
  const gradientLength = Math.hypot(gx, gy);
  if (gradientLength < 0.000001) return null;
  return normalizeVector({ x: -gy, y: gx });
}

function getAreaLockConstraint(pointId) {
  const face = state.faces.find((candidate) => candidate.includes(pointId));
  if (!face || face.length < 3) return null;

  const index = face.indexOf(pointId);
  const point = findPointById(pointId);
  if (!point) return null;

  const area = polygonAreaFromPoints(faceOutlineImagePoints(face));
  const direction = areaLockTangentDirection(pointId, face, point, area)
    || areaLockFallbackDirection(face, index);
  if (!direction) return null;

  return {
    pointId,
    face,
    area,
    origin: { x: point.x, y: point.y },
    ux: direction.x,
    uy: direction.y,
  };
}

function areaWithPointOverride(constraint, point) {
  const overrides = new Map([[constraint.pointId, point]]);
  return polygonAreaFromPoints(faceOutlineImagePoints(constraint.face, overrides));
}

function constrainPointToCurvedArea(target, origin, constraint) {
  if (!constraint) return target;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;

  if (!constraint.face || !constraint.pointId || !Number.isFinite(constraint.area)) {
    return target;
  }

  const dragLength = Math.hypot(dx, dy);
  const along = dragLength > 0.001
    ? { x: dx / dragLength, y: dy / dragLength }
    : { x: constraint.ux, y: constraint.uy };
  const normal = { x: -along.y, y: along.x };
  const pointAt = (offset) => ({
    x: target.x + normal.x * offset,
    y: target.y + normal.y * offset,
  });

  const areaAt = (offset) => areaWithPointOverride(constraint, pointAt(offset));
  const targetArea = constraint.area;
  const tolerance = Math.max(0.02, targetArea * 0.0004);
  const targetError = Math.abs(areaAt(0) - targetArea);
  if (targetError <= tolerance) {
    return target;
  }

  let bestOffset = 0;
  let bestError = targetError;
  const candidates = [0];

  let step = Math.max(8, dragLength * 0.35);
  for (let round = 0; round < 9; round += 1) {
    candidates.push(-step, step);
    step *= 1.7;
  }

  const uniqueCandidates = [...new Set(candidates.map((offset) => roundCoord(offset)))].sort((a, b) => a - b);
  const brackets = [];
  let previousOffset = uniqueCandidates[0];
  let previousValue = areaAt(previousOffset) - targetArea;
  uniqueCandidates.forEach((offset) => {
    const value = areaAt(offset) - targetArea;
    const error = Math.abs(value);
    if (error < bestError) {
      bestError = error;
      bestOffset = offset;
    }
    if (previousValue * value <= 0 && Math.abs(previousOffset - offset) > 0.001) {
      brackets.push([previousOffset, offset]);
    }
    previousOffset = offset;
    previousValue = value;
  });

  const nearestBracket = brackets
    .sort((a, b) => (
      Math.abs((a[0] + a[1]) / 2)
      - Math.abs((b[0] + b[1]) / 2)
    ))[0];

  if (nearestBracket) {
    let [lo, hi] = nearestBracket;
    let loValue = areaAt(lo) - targetArea;
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const mid = (lo + hi) / 2;
      const midValue = areaAt(mid) - targetArea;
      if (Math.abs(midValue) < bestError) {
        bestError = Math.abs(midValue);
        bestOffset = mid;
      }
      if (loValue * midValue <= 0) {
        hi = mid;
      } else {
        lo = mid;
        loValue = midValue;
      }
    }
  }

  return bestError < targetError ? pointAt(bestOffset) : target;
}

function constrainPointToAreaLine(target, origin, constraint) {
  return constrainPointToCurvedArea(target, origin, constraint);
}

function getAreaLockCurveConstraint(edgeIndex) {
  const edge = state.edges[edgeIndex];
  if (!edge) return null;
  const face = state.faces.find((candidate) => (
    candidate.includes(edge[0]) && candidate.includes(edge[1])
  ));
  if (!face || face.length < 3) return null;

  return {
    edgeIndex,
    face,
    area: polygonAreaFromPoints(faceOutlineImagePoints(face)),
  };
}

function constrainCurveControlsToArea(edgeIndex, targetControls, constraint, lockedHandle = null) {
  if (
    !constraint
    || !targetControls?.c1
    || !targetControls?.c2
    || !Number.isFinite(constraint.area)
  ) {
    return targetControls;
  }

  const edge = state.edges[edgeIndex];
  const from = edge ? findPointById(edge[0]) : null;
  const to = edge ? findPointById(edge[1]) : null;
  if (!edge || !from || !to) return targetControls;

  const chord = { x: to.x - from.x, y: to.y - from.y };
  const chordLength = Math.hypot(chord.x, chord.y);
  if (chordLength === 0) return targetControls;

  const normal = { x: -chord.y / chordLength, y: chord.x / chordLength };
  const adjustableHandle = lockedHandle === "c2" ? "c1" : "c2";
  const controlsAt = (offset) => {
    const controls = structuredClone(targetControls);
    controls[adjustableHandle].x += normal.x * offset;
    controls[adjustableHandle].y += normal.y * offset;
    return controls;
  };
  const areaAt = (offset) => polygonAreaFromPoints(faceOutlineImagePoints(constraint.face, {
    edgeControls: new Map([[edgeIndex, controlsAt(offset)]]),
  }));

  const targetArea = constraint.area;
  const tolerance = Math.max(0.03, targetArea * 0.0005);
  const targetError = Math.abs(areaAt(0) - targetArea);
  if (targetError <= tolerance) return targetControls;

  let bestOffset = 0;
  let bestError = targetError;
  const candidates = [0];
  let step = Math.max(8, chordLength * 0.15);
  for (let round = 0; round < 9; round += 1) {
    candidates.push(-step, step);
    step *= 1.6;
  }

  const uniqueCandidates = [...new Set(candidates.map((offset) => roundCoord(offset)))]
    .sort((a, b) => a - b);
  const brackets = [];
  let previousOffset = uniqueCandidates[0];
  let previousValue = areaAt(previousOffset) - targetArea;

  uniqueCandidates.forEach((offset) => {
    const value = areaAt(offset) - targetArea;
    const error = Math.abs(value);
    if (error < bestError) {
      bestError = error;
      bestOffset = offset;
    }
    if (previousValue * value <= 0 && Math.abs(previousOffset - offset) > 0.001) {
      brackets.push([previousOffset, offset]);
    }
    previousOffset = offset;
    previousValue = value;
  });

  const nearestBracket = brackets
    .sort((a, b) => Math.abs((a[0] + a[1]) / 2) - Math.abs((b[0] + b[1]) / 2))[0];

  if (nearestBracket) {
    let [lo, hi] = nearestBracket;
    let loValue = areaAt(lo) - targetArea;
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const mid = (lo + hi) / 2;
      const midValue = areaAt(mid) - targetArea;
      if (Math.abs(midValue) < bestError) {
        bestError = Math.abs(midValue);
        bestOffset = mid;
      }
      if (loValue * midValue <= 0) {
        hi = mid;
      } else {
        lo = mid;
        loValue = midValue;
      }
    }
  }

  if (bestError < targetError * 0.65 || bestError <= Math.max(tolerance, targetArea * 0.006)) {
    return controlsAt(bestOffset);
  }
  return targetControls;
}

function polygonAreaFromPoints(points) {
  if (points.length < 3) return 0;
  const sum = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(sum) / 2;
}

function polygonCentroidFromPoints(points) {
  if (points.length === 0) return { x: 0, y: 0 };
  const areaSignedDouble = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);

  if (Math.abs(areaSignedDouble) < 0.000001) {
    return {
      x: points.reduce((total, point) => total + point.x, 0) / points.length,
      y: points.reduce((total, point) => total + point.y, 0) / points.length,
    };
  }

  let cx = 0;
  let cy = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const cross = point.x * next.y - next.x * point.y;
    cx += (point.x + next.x) * cross;
    cy += (point.y + next.y) * cross;
  });
  return {
    x: cx / (3 * areaSignedDouble),
    y: cy / (3 * areaSignedDouble),
  };
}

function roundedRectPath(targetCtx, x, y, width, height, radius) {
  if (typeof targetCtx.roundRect === "function") {
    targetCtx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + width - r, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
  targetCtx.lineTo(x + width, y + height - r);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  targetCtx.lineTo(x + r, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
}

function currentLoupePoint() {
  if (state.cursorImagePoint) return state.cursorImagePoint;
  return state.points.find((point) => state.selected.has(point.id)) || null;
}

function roundCoord(value) {
  return Math.round(value * 1000) / 1000;
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function nextPointName() {
  const base = els.pointName.value.trim() || `P${state.points.length + 1}`;
  const match = base.match(/^(.*?)(\d+)$/);
  if (match) {
    els.pointName.value = `${match[1]}${Number(match[2]) + 1}`;
  } else {
    els.pointName.value = `${base}2`;
  }
  return base;
}

function setMode(mode) {
  if (mode === "source" && state.mode === "source") {
    mode = "select";
  }
  state.mode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  state.calibrationClicks = [];
  setStatus(statusForMode(mode));
  updateCoach();
  draw();
}

function statusForMode(mode) {
  if (mode === "select") return t("status.select");
  if (mode === "calibrate") return t("status.calibrate");
  if (mode === "origin") return t("status.origin");
  if (mode === "source") return t("status.source");
  if (mode === "sketch") return t("status.sketch");
  if (mode === "sketch-circle") return t("status.sketchCircle");
  if (mode === "circle") return t("status.circle");
  if (mode === "pan") return t("status.pan");
  if (mode === "curve") return t("status.curve");
  return t("status.point");
}

function setStatus(message) {
  els.canvasStatus.textContent = message;
}

function nextCoachMessage() {
  if (!state.image) {
    return t("coach.start");
  }
  if (state.mode === "sketch") {
    return t("status.sketch");
  }
  if (state.mode === "sketch-circle") {
    return t("status.sketchCircle");
  }
  if (state.mode === "circle") {
    return t("status.circle");
  }
  if (!state.cmPerPixel) {
    if (state.mode === "calibrate") {
      return state.language === "en"
        ? "Click 2 points, enter the real length, then confirm the distance."
        : "2点クリックしてから、実寸の長さを入力し「距離を確定」を押します。";
    }
    return state.language === "en"
      ? "Set the real-world scale first so coordinates and exports use real dimensions."
      : "最初に「スケール設定」で実寸を決めると、座標や保存が実寸になります。";
  }
  if (state.points.length === 0) {
    return state.language === "en"
      ? "Click corners or landmarks on the outline to place points."
      : "輪郭の角や目印をクリックして、点を置きます。";
  }
  if (state.mode === "curve") {
    return state.selectedEdgeIndex === null
      ? (state.language === "en" ? "Click the line you want to bend, then drag it into a curve." : "曲げたい線をクリックして、ドラッグするとカーブになります。")
      : (state.language === "en" ? "Move the blue handles to match the curve shape." : "青いハンドルを動かして、カーブを形に合わせます。");
  }
  if (state.mode === "select") {
    return t("status.select");
  }
  if (state.mode === "source") {
    return t("status.source");
  }
  if (state.mode === "pan") {
    return t("status.pan");
  }
  if (state.currentPathIds.length >= 3 && state.faces.length === 0) {
    return state.language === "en"
      ? "When the outline comes around, use Close to create a face."
      : "輪郭が一周したら「閉じる」で面にします。";
  }
  if (state.faces.length > 0) {
    if (state.selected.size > 0) {
      return state.language === "en"
        ? "Drag points to fine-tune. Select a line to use horizontal, vertical, or straighten."
        : "点はドラッグで微調整できます。線を選ぶと水平・垂直や直線戻しも使えます。";
    }
    return state.language === "en"
      ? "A closed face is ready. You can export DXF or MD/CLO Python."
      : "閉じた面ができました。DXFやMD/CLO用Pythonで保存できます。";
  }
  return state.language === "en"
    ? "Place points in order to trace the outline."
    : "点を順番に置いて、線で輪郭をつないでいきます。";
}

function updateCoach() {
  if (!els.coachText) return;
  els.coachText.textContent = nextCoachMessage();
}

function fitImage() {
  if (!state.image) {
    draw();
    return;
  }
  const size = canvasCssSize();
  const pad = 42;
  const zoom = Math.min((size.width - pad * 2) / state.image.width, (size.height - pad * 2) / state.image.height);
  state.view.zoom = Math.max(0.05, zoom);
  state.view.x = (size.width - state.image.width * state.view.zoom) / 2;
  state.view.y = (size.height - state.image.height * state.view.zoom) / 2;
  updateFitButton();
  draw();
}

function toggleFitImage() {
  if (!state.image) {
    fitImage();
    return;
  }
  if (state.fitViewBefore) {
    state.view = structuredClone(state.fitViewBefore);
    state.fitViewBefore = null;
    updateFitButton();
    draw();
    return;
  }
  state.fitViewBefore = structuredClone(state.view);
  fitImage();
}

function updateFitButton() {
  els.fitButton.classList.toggle("active", Boolean(state.fitViewBefore));
  els.fitButton.title = state.fitViewBefore ? t("top.fitBack") : t("top.fit");
}

function createSampleImage() {
  const sample = document.createElement("canvas");
  sample.width = 900;
  sample.height = 620;
  const sctx = sample.getContext("2d");
  const gridLeft = 80;
  const gridRight = 830;
  const gridTop = 60;
  const gridBottom = 560;
  const origin = { x: gridLeft, y: gridBottom };
  const scaleStart = { x: gridLeft + 50, y: gridBottom - 25 };
  const scaleEnd = { x: scaleStart.x + 250, y: scaleStart.y };

  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, sample.width, sample.height);
  sctx.strokeStyle = "#d2d8de";
  sctx.lineWidth = 1;
  for (let x = gridLeft; x <= gridRight; x += 50) {
    sctx.beginPath();
    sctx.moveTo(x, gridTop);
    sctx.lineTo(x, gridBottom);
    sctx.stroke();
  }
  for (let y = gridTop; y <= gridBottom; y += 50) {
    sctx.beginPath();
    sctx.moveTo(gridLeft, y);
    sctx.lineTo(gridRight, y);
    sctx.stroke();
  }

  sctx.strokeStyle = "#20242a";
  sctx.lineWidth = 4;
  drawPolygon(sctx, [
    [180, 435],
    [330, 185],
    [480, 435],
  ]);
  drawPolygon(sctx, [
    [580, 185],
    [830, 185],
    [830, 435],
    [580, 435],
  ]);

  sctx.strokeStyle = "#20242a";
  sctx.lineWidth = 2;
  sctx.beginPath();
  sctx.moveTo(scaleStart.x, scaleStart.y);
  sctx.lineTo(scaleEnd.x, scaleEnd.y);
  sctx.stroke();
  sctx.fillStyle = "#20242a";
  sctx.font = "22px sans-serif";
  sctx.fillText("scale sample: 10 cm", scaleStart.x + 28, scaleStart.y - 10);

  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.imageName = "sample-shapes";
    state.points = [];
    state.edges = [];
    state.faces = [];
    state.currentPathLast = null;
    state.currentPathIds = [];
    state.sourceOffset = { x: 0, y: 0 };
    state.sourceScale = 1;
    state.sketchStrokes = [];
    state.sketchCircles = [];
    state.dxfGuidePaths = [];
    state.fitViewBefore = null;
    state.imageOpacity = DEFAULT_IMAGE_OPACITY;
    opacityInput.value = String(DEFAULT_IMAGE_OPACITY);
    setShapeOpacity(DEFAULT_SHAPE_OPACITY);
    state.selected.clear();
    state.selectedFaceIndex = null;
    state.cmPerPixel = 10 / 250;
    state.origin = origin;
    state.calibrationClicks = [
      { x: scaleStart.x, y: scaleStart.y },
      { x: scaleEnd.x, y: scaleEnd.y },
    ];
    els.knownLength.value = "10";
    els.unit.value = "cm";
    els.knownLengthUnit.textContent = "cm";
    arrowMoveUnit.textContent = "cm";
    clearUndoHistory();
    updateAll();
    fitImage();
    setStatus(state.language === "en"
      ? "Sample shapes are ready. Click corners on the triangle or rectangle to try tracing."
      : "テスト図形を表示しました。三角形や四角形の角をクリックして試せます。");
  };
  img.src = sample.toDataURL("image/png");
}

function createBlankGrid() {
  const grid = document.createElement("canvas");
  grid.width = 1000;
  grid.height = 720;
  const gridLeft = 80;
  const gridBottom = 660;
  const origin = { x: gridLeft, y: gridBottom };

  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.imageName = "blank-grid";
    state.points = [];
    state.edges = [];
    state.faces = [];
    state.currentPathLast = null;
    state.currentPathIds = [];
    state.sourceOffset = { x: 0, y: 0 };
    state.sourceScale = 1;
    state.sketchStrokes = [];
    state.sketchCircles = [];
    state.dxfGuidePaths = [];
    state.fitViewBefore = null;
    state.imageOpacity = 0;
    opacityInput.value = "0";
    state.showCanvasGrid = true;
    state.selected.clear();
    clearSelectedEdges();
    state.selectedFaceIndex = null;
    state.cmPerPixel = 1 / GRID_PAPER_MINOR_PX;
    state.origin = origin;
    state.calibrationClicks = [
      { x: origin.x, y: origin.y },
      { x: origin.x + GRID_PAPER_MINOR_PX * 10, y: origin.y },
    ];
    els.knownLength.value = "10";
    els.unit.value = "cm";
    els.knownLengthUnit.textContent = "cm";
    arrowMoveUnit.textContent = "cm";
    els.pointName.value = "P1";
    clearUndoHistory();
    applyLanguage();
    updateAll();
    fitImage();
    setStatus(state.language === "en"
      ? "Grid paper ready. Small squares are 1 cm; large squares are 5 cm."
      : "方眼紙を表示しました。小マス1cm、太線1マス5cmです。");
  };
  img.src = grid.toDataURL("image/png");
}

function drawPolygon(targetCtx, coords) {
  targetCtx.beginPath();
  coords.forEach(([x, y], index) => {
    if (index === 0) targetCtx.moveTo(x, y);
    else targetCtx.lineTo(x, y);
  });
  targetCtx.closePath();
  targetCtx.stroke();
}

function loadImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.imageName = file.name.replace(/\.[^.]+$/, "") || "image";
      state.points = [];
      state.edges = [];
      state.faces = [];
      state.currentPathLast = null;
      state.currentPathIds = [];
      state.sourceOffset = { x: 0, y: 0 };
      state.sourceScale = 1;
      state.sketchStrokes = [];
      state.sketchCircles = [];
      state.dxfGuidePaths = [];
      state.fitViewBefore = null;
      state.imageOpacity = DEFAULT_IMAGE_OPACITY;
      opacityInput.value = String(DEFAULT_IMAGE_OPACITY);
      setShapeOpacity(DEFAULT_SHAPE_OPACITY);
      state.selected.clear();
      clearSelectedEdges();
      state.selectedFaceIndex = null;
      state.showCanvasGrid = true;
      state.cmPerPixel = 1 / GRID_PAPER_MINOR_PX;
      state.origin = { x: 80, y: 660 };
      state.calibrationClicks = [
        { x: state.origin.x, y: state.origin.y },
        { x: state.origin.x + GRID_PAPER_MINOR_PX * 10, y: state.origin.y },
      ];
      els.knownLength.value = "10";
      els.unit.value = "cm";
      els.knownLengthUnit.textContent = "cm";
      arrowMoveUnit.textContent = "cm";
      clearUndoHistory();
      updateAll();
      fitImage();
      setStatus(state.language === "en"
        ? "Image loaded on the grid paper with the default origin and 10 cm guide. Calibrate scale if needed."
        : "画像を方眼紙の上に読み込みました。方眼紙と同じ原点と10cm四角を表示しています。必要ならスケールを設定してください。");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function handleCanvasClick(event) {
  if (!state.image || state.drag?.moved) return;
  if (state.skipNextCanvasClick) {
    state.skipNextCanvasClick = false;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const imagePoint = screenToImage(screenPoint.x, screenPoint.y);

  if (state.mode === "calibrate") {
    if (state.calibrationClicks.length >= 2) state.calibrationClicks = [];
    state.calibrationClicks.push(imagePoint);
    if (state.calibrationClicks.length === 2) {
      setStatus("2点を取りました。2点間の実寸を入力して「距離を確定」を押してください。例: 38cmなら38");
    } else {
      setStatus("スケールの1点目を置きました。もう片方の端をクリックしてください。");
    }
    updateAll();
    return;
  }

  if (state.mode === "origin") {
    pushHistory();
    state.origin = imagePoint;
    updateAll();
    setStatus("原点を設定しました。");
    return;
  }

  if (state.mode === "select") {
    const edgeHit = hitTestEdge(screenPoint.x, screenPoint.y);
    if (event.shiftKey && edgeHit) {
      state.selected.clear();
      state.selectedFaceIndex = null;
      toggleSelectedEdge(edgeHit.index);
      announceSelectedEdges();
      updateAll();
      return;
    }

    const existingPoint = hitTestPoint(screenPoint.x, screenPoint.y);
    if (existingPoint) {
      if (event.shiftKey) {
        if (state.selected.has(existingPoint.id)) state.selected.delete(existingPoint.id);
        else state.selected.add(existingPoint.id);
      } else {
        state.selected.clear();
        state.selected.add(existingPoint.id);
      }
      clearSelectedEdges();
      state.selectedFaceIndex = null;
      setStatus(`${existingPoint.name}を選択しました。`);
      updateAll();
      return;
    }

    if (edgeHit) {
      state.selected.clear();
      state.selectedFaceIndex = null;
      state.selectedCurveHandle = null;
      setSingleSelectedEdge(edgeHit.index);
      announceSelectedEdges();
      updateAll();
      return;
    }

    const faceHit = hitTestFace(imagePoint);
    if (faceHit) {
      state.selected = new Set(faceHit.face);
      clearSelectedEdges();
      state.selectedFaceIndex = faceHit.index;
      setStatus("閉じた図を選択しました。移動・回転・拡大縮小や削除が使えます。");
      updateAll();
      return;
    }

    state.selected.clear();
    clearSelectedEdges();
    state.selectedFaceIndex = null;
    setStatus("選択を解除しました。");
    updateAll();
    return;
  }

  if (state.mode === "point") {
    const existingPoint = hitTestPoint(screenPoint.x, screenPoint.y);
    if (existingPoint) {
      if (event.shiftKey) {
        if (state.selected.has(existingPoint.id)) state.selected.delete(existingPoint.id);
        else state.selected.add(existingPoint.id);
      } else {
        state.selected.clear();
        state.selected.add(existingPoint.id);
        clearSelectedEdges();
        state.selectedFaceIndex = null;
      }
      setStatus(`${existingPoint.name}を選択しました。ドラッグまたは矢印キーで移動できます。`);
      updateAll();
      return;
    }

    const edgeHit = hitTestEdge(screenPoint.x, screenPoint.y);
    if (edgeHit) {
      insertPointOnEdge(edgeHit);
      return;
    }

    pushHistory();
    const snappedPoint = snapImagePointToGrid(imagePoint);
    const point = {
      id: crypto.randomUUID(),
      name: nextPointName(),
      x: snappedPoint.x,
      y: snappedPoint.y,
    };
    state.points.push(point);
    state.selected.clear();
    state.selected.add(point.id);
    clearSelectedEdges();
    state.selectedFaceIndex = null;
    if (state.autoConnect && state.currentPathLast) {
      addEdge(state.currentPathLast, point.id);
    }
    state.currentPathLast = point.id;
    state.currentPathIds.push(point.id);
    updateAll();
  }
}

function handleCanvasDoubleClick(event) {
  if (!state.image || state.mode !== "point") return;
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const point = hitTestPoint(screenPoint.x, screenPoint.y);
  if (!point || point.id !== state.currentPathLast) return;

  closeCurrentPath();
}

function handlePointerDown(event) {
  if (!state.image) return;
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };

  if (shouldStartViewportPan(event)) {
    event.preventDefault();
    state.skipNextCanvasClick = true;
    canvas.classList.add("is-view-panning");
    state.drag = {
      type: "viewport-pan",
      startX: screen.x,
      startY: screen.y,
      viewX: state.view.x,
      viewY: state.view.y,
      moved: false,
    };
    setStatus(t("status.viewPan"));
    return;
  }

  if (state.mode === "source") {
    state.drag = {
      type: "source",
      startX: screen.x,
      startY: screen.y,
      offsetX: state.sourceOffset.x,
      offsetY: state.sourceOffset.y,
      before: snapshotTrace(),
      moved: false,
    };
    setStatus(state.language === "en"
      ? "Moving the underlay. Use the mouse wheel in this mode to scale only the underlay."
      : "下敷きを移動中です。このモード中はホイールで下敷きだけ拡大縮小できます。");
    return;
  }

  if (state.mode === "sketch") {
    const imagePoint = sketchImagePoint(screenToImage(screen.x, screen.y));
    const before = snapshotTrace();
    const stroke = {
      id: crypto.randomUUID(),
      points: [imagePoint],
    };
    state.sketchStrokes.push(stroke);
    state.drag = {
      type: "sketch",
      strokeId: stroke.id,
      startX: screen.x,
      startY: screen.y,
      before,
      moved: true,
    };
    setStatus(t("status.sketch"));
    draw();
    return;
  }

  if (state.mode === "sketch-circle") {
    const center = sketchImagePoint(screenToImage(screen.x, screen.y));
    const before = snapshotTrace();
    const circle = {
      id: crypto.randomUUID(),
      cx: center.x,
      cy: center.y,
      radius: 0,
    };
    state.sketchCircles.push(circle);
    state.drag = {
      type: "sketch-circle",
      circleId: circle.id,
      startX: screen.x,
      startY: screen.y,
      before,
      moved: false,
    };
    setStatus(t("status.sketchCircle"));
    draw();
    return;
  }

  if (state.mode === "circle") {
    const center = sketchImagePoint(screenToImage(screen.x, screen.y));
    state.skipNextCanvasClick = true;
    state.drag = {
      type: "pattern-circle",
      center,
      radius: 0,
      startX: screen.x,
      startY: screen.y,
      before: snapshotTrace(),
      moved: false,
    };
    setStatus(t("status.circleDrawing"));
    draw();
    return;
  }

  const selectedPointHit = (state.mode === "point" || state.mode === "select" || state.mode === "curve")
    ? hitTestSelectedPoint(screen.x, screen.y)
    : null;

  if ((state.mode === "curve" || state.mode === "select") && !selectedPointHit) {
    const handleHit = hitTestCurveHandle(screen.x, screen.y);
    if (handleHit) {
      state.skipNextCanvasClick = true;
      setSelectedCurveHandle(handleHit.index, handleHit.handle);
      state.selected.clear();
      state.selectedFaceIndex = null;
      state.drag = {
        type: "curve-handle",
        edgeIndex: handleHit.index,
        handle: handleHit.handle,
        startX: screen.x,
        startY: screen.y,
        controlX: handleHit.control.x,
        controlY: handleHit.control.y,
        controls: structuredClone(edgeCubicControls(handleHit.edge)),
        areaConstraint: state.areaLock ? getAreaLockCurveConstraint(handleHit.index) : null,
        before: snapshotTrace(),
        moved: false,
      };
      setStatus("カーブハンドルを選択しました。ドラッグまたは方向キーで微調整できます。");
      updateAll();
      return;
    }
  }

  if (state.mode === "point" || state.mode === "select" || state.mode === "curve") {
    const point = selectedPointHit || hitTestPoint(screen.x, screen.y);
    if (point) {
      if (event.shiftKey) {
        if (state.selected.has(point.id)) state.selected.delete(point.id);
        else state.selected.add(point.id);
      } else if (!state.selected.has(point.id)) {
        state.selected.clear();
        state.selected.add(point.id);
      }
      if (state.selected.size === 0) state.selected.add(point.id);
      const movingPointIds = [...state.selected].filter((id) => state.points.some((candidate) => candidate.id === id));
      if (!movingPointIds.includes(point.id)) movingPointIds.push(point.id);
      const movingPoints = state.points
        .filter((candidate) => movingPointIds.includes(candidate.id))
        .map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y }));
      clearSelectedEdges();
      state.selectedFaceIndex = null;
      state.drag = {
        type: "point",
        pointId: point.id,
        startX: screen.x,
        startY: screen.y,
        pointX: point.x,
        pointY: point.y,
        points: movingPoints,
        edgeControls: edgeControlSnapshotsForMovingPoints(movingPointIds),
        areaConstraint: state.areaLock && movingPoints.length === 1 ? getAreaLockConstraint(point.id) : null,
        before: snapshotTrace(),
        moved: false,
      };
      setStatus(movingPoints.length > 1
        ? `${movingPoints.length}点を選択しました。ドラッグでまとめて移動できます。`
        : `${point.name}を選択しました。ドラッグまたは方向キーで移動できます。`);
      updateAll();
      return;
    }
  }

  if (state.mode === "point" || state.mode === "select" || state.mode === "curve") {
    const selectedMoveBounds = selectedPointScreenBounds(POINT_HIT_RADIUS);
    const selectedPointIds = [...state.selected].filter((id) => state.points.some((candidate) => candidate.id === id));
    if (selectedPointIds.length > 1 && !selectedExplicitFaceTarget() && pointInsideBox(screen, selectedMoveBounds)) {
      const movingPoints = state.points
        .filter((candidate) => selectedPointIds.includes(candidate.id))
        .map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y }));
      const anchor = movingPoints[0];
      state.skipNextCanvasClick = true;
      clearSelectedEdges();
      state.selectedFaceIndex = null;
      state.drag = {
        type: "point",
        pointId: anchor.id,
        startX: screen.x,
        startY: screen.y,
        pointX: anchor.x,
        pointY: anchor.y,
        points: movingPoints,
        edgeControls: edgeControlSnapshotsForMovingPoints(selectedPointIds),
        areaConstraint: null,
        before: snapshotTrace(),
        moved: false,
      };
      setStatus(`${movingPoints.length}点を選択しました。枠内ドラッグでまとめて移動できます。`);
      updateAll();
      return;
    }
  }

  if (state.mode === "curve") {
    const edgeHit = hitTestEdge(screen.x, screen.y);
    if (edgeHit) {
      const imagePoint = screenToImage(screen.x, screen.y);
      const before = snapshotTrace();
      const areaConstraint = state.areaLock ? getAreaLockCurveConstraint(edgeHit.index) : null;
      if (!edgeCubicControls(edgeHit.edge)) {
        initializeEdgeControls(edgeHit.edge, imagePoint);
      }
      state.selectedCurveHandle = null;
      setSingleSelectedEdge(edgeHit.index);
      state.selectedFaceIndex = null;
      state.selected.clear();
      state.drag = {
        type: "curve",
        edgeIndex: edgeHit.index,
        startX: screen.x,
        startY: screen.y,
        controls: structuredClone(edgeCubicControls(edgeHit.edge)),
        areaConstraint,
        before,
        moved: false,
      };
      setStatus(`線をドラッグして曲げます。長さ ${formatSelectedEdgeLength(state.edges[edgeHit.index])}。`);
      updateAll();
      return;
    }
  }

  if ((state.mode === "select" || state.mode === "pan") && state.points.length > 0) {
    const transformHit = hitTestFaceTransformHandle(screen.x, screen.y);
    if (transformHit) {
      const { geometry } = transformHit;
      const snapshot = faceTransformSnapshot(geometry.target.face);
      const centerScreen = geometry.center;
      state.selected = new Set(geometry.target.face);
      clearSelectedEdges();
      state.selectedFaceIndex = geometry.target.index;
      state.drag = {
        type: "face-transform",
        action: transformHit.type,
        faceIndex: geometry.target.index,
        center: geometry.centerImage,
        startAngle: Math.atan2(screen.y - centerScreen.y, screen.x - centerScreen.x),
        startDistance: Math.max(1, Math.hypot(screen.x - centerScreen.x, screen.y - centerScreen.y)),
        snapshot,
        before: snapshotTrace(),
        moved: false,
      };
      setStatus(transformHit.type === "rotate" ? "選んだ図を回転中です。" : "選んだ図を拡大縮小中です。");
      updateAll();
      return;
    }

    const imagePoint = screenToImage(screen.x, screen.y);
    const faceHit = hitTestFace(imagePoint);
    if (!faceHit) {
      if (state.mode === "select") {
        state.selectedCurveHandle = null;
        state.drag = {
          type: "selection-box",
          startX: screen.x,
          startY: screen.y,
          currentX: screen.x,
          currentY: screen.y,
          additive: event.shiftKey,
          moved: false,
        };
        setStatus(t("status.boxSelect"));
        draw();
        return;
      }
      setStatus("移動したい閉じた図の内側をドラッグしてください。");
      return;
    }
    const facePointIds = new Set(faceHit.face);
    const edgeIndexes = state.edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => facePointIds.has(edge[0]) && facePointIds.has(edge[1]))
      .map(({ index }) => index);
    state.selected = new Set(faceHit.face);
    clearSelectedEdges();
    state.selectedFaceIndex = faceHit.index;
    state.drag = {
      type: "pattern",
      faceIndex: faceHit.index,
      startX: screen.x,
      startY: screen.y,
      points: state.points
        .filter((point) => facePointIds.has(point.id))
        .map((point) => ({ id: point.id, x: point.x, y: point.y })),
      edgeControls: edgeIndexes.map((index) => ({
        index,
        control: structuredClone(edgeControl(state.edges[index])),
      })),
      before: snapshotTrace(),
      moved: false,
    };
    setStatus("選んだ図を移動中です。");
    updateCoach();
  }
}

function handlePointerMove(event) {
  if (!state.drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  state.cursorImagePoint = screenToImage(x, y);
  const dx = x - state.drag.startX;
  const dy = y - state.drag.startY;
  if (Math.hypot(dx, dy) > 2) state.drag.moved = true;

  if (state.drag.type === "viewport-pan") {
    state.view.x = state.drag.viewX + dx;
    state.view.y = state.drag.viewY + dy;
    state.fitViewBefore = null;
    updateFitButton();
    setStatus(t("status.viewPan"));
    draw();
    return;
  }

  if (state.drag.type === "point") {
    const dragPoints = state.drag.points?.length
      ? state.drag.points
      : [{ id: state.drag.pointId, x: state.drag.pointX, y: state.drag.pointY }];
    const anchor = dragPoints.find((snapshot) => snapshot.id === state.drag.pointId) || dragPoints[0];
    if (!anchor) return;
    let imageDx = dx / state.view.zoom;
    let imageDy = dy / state.view.zoom;
    if (state.drag.areaConstraint) {
      const target = {
        x: anchor.x + imageDx,
        y: anchor.y + imageDy,
      };
      const constrained = constrainPointToAreaLine(
        target,
        { x: anchor.x, y: anchor.y },
        state.drag.areaConstraint,
      );
      imageDx = constrained.x - anchor.x;
      imageDy = constrained.y - anchor.y;
    } else if (state.snapToGrid) {
      const snappedAnchor = snapImagePointToGrid({
        x: anchor.x + imageDx,
        y: anchor.y + imageDy,
      });
      imageDx = snappedAnchor.x - anchor.x;
      imageDy = snappedAnchor.y - anchor.y;
    }
    dragPoints.forEach((snapshot) => {
      const point = state.points.find((candidate) => candidate.id === snapshot.id);
      if (!point) return;
      point.x = snapshot.x + imageDx;
      point.y = snapshot.y + imageDy;
    });
    state.drag.edgeControls?.forEach(({ index, control }) => {
      const edge = state.edges[index];
      if (edge && control) edge[2] = shiftedEdgeControl(control, imageDx, imageDy);
    });
    setStatus(dragPoints.length > 1 ? `${dragPoints.length}点を移動中です。` : `${findPointById(anchor.id)?.name || "点"}を移動中です。`);
    updateDragPreview();
    return;
  }

  if (state.drag.type === "source") {
    state.sourceOffset.x = state.drag.offsetX + dx / state.view.zoom;
    state.sourceOffset.y = state.drag.offsetY + dy / state.view.zoom;
    setStatus(state.language === "en"
      ? "Moving the underlay. Points, lines, origin, and scale square stay fixed."
      : "下敷きを移動中です。点・線・原点・スケール四角は固定です。");
    updateDragPreview();
    return;
  }

  if (state.drag.type === "sketch") {
    const stroke = state.sketchStrokes.find((candidate) => candidate.id === state.drag.strokeId);
    if (!stroke) return;
    const imagePoint = sketchImagePoint(screenToImage(x, y));
    appendSketchPoint(stroke, imagePoint);
    setStatus(t("status.sketch"));
    draw();
    return;
  }

  if (state.drag.type === "sketch-circle") {
    const circle = state.sketchCircles.find((candidate) => candidate.id === state.drag.circleId);
    if (!circle) return;
    const current = sketchImagePoint(screenToImage(x, y));
    circle.radius = Math.max(0, Math.hypot(current.x - circle.cx, current.y - circle.cy));
    setStatus(t("status.sketchCircle"));
    draw();
    return;
  }

  if (state.drag.type === "pattern-circle") {
    const current = sketchImagePoint(screenToImage(x, y));
    state.drag.radius = Math.max(0, Math.hypot(current.x - state.drag.center.x, current.y - state.drag.center.y));
    setStatus(t("status.circleDrawing"));
    draw();
    return;
  }

  if (state.drag.type === "selection-box") {
    state.drag.currentX = x;
    state.drag.currentY = y;
    setStatus(t("status.boxSelect"));
    draw();
    return;
  }

  if (state.drag.type === "curve") {
    const edge = state.edges[state.drag.edgeIndex];
    if (!edge) return;
    setSingleSelectedEdge(state.drag.edgeIndex);
    const targetControls = {
      c1: {
        x: state.drag.controls.c1.x + dx / state.view.zoom,
        y: state.drag.controls.c1.y + dy / state.view.zoom,
      },
      c2: {
        x: state.drag.controls.c2.x + dx / state.view.zoom,
        y: state.drag.controls.c2.y + dy / state.view.zoom,
      },
    };
    edge[2] = constrainCurveControlsToArea(
      state.drag.edgeIndex,
      targetControls,
      state.drag.areaConstraint,
      "c1",
    );
    setStatus(state.drag.areaConstraint ? "面積を保ちながら線を曲げています。" : "線を曲げています。");
    updateDragPreview();
    return;
  }

  if (state.drag.type === "curve-handle") {
    const edge = state.edges[state.drag.edgeIndex];
    if (!edge) return;
    if (!edge[2]?.c1 || !edge[2]?.c2) {
      edge[2] = edgeCubicControls(edge);
    }
    setSelectedCurveHandle(state.drag.edgeIndex, state.drag.handle);
    const targetControls = structuredClone(state.drag.controls || edgeCubicControls(edge));
    targetControls[state.drag.handle] = {
      x: state.drag.controlX + dx / state.view.zoom,
      y: state.drag.controlY + dy / state.view.zoom,
    };
    edge[2] = constrainCurveControlsToArea(
      state.drag.edgeIndex,
      targetControls,
      state.drag.areaConstraint,
      state.drag.handle,
    );
    setStatus(state.drag.areaConstraint ? "面積を保ちながらカーブを調整しています。" : "カーブを調整しています。");
    updateDragPreview();
    return;
  }

  if (state.drag.type === "pattern") {
    const imageDx = dx / state.view.zoom;
    const imageDy = dy / state.view.zoom;
    state.drag.points.forEach((snapshot) => {
      const point = findPointById(snapshot.id);
      if (!point) return;
      point.x = snapshot.x + imageDx;
      point.y = snapshot.y + imageDy;
    });
    state.drag.edgeControls.forEach(({ index, control }) => {
      const edge = state.edges[index];
      if (edge && control) edge[2] = shiftedEdgeControl(control, imageDx, imageDy);
    });
    setStatus("選んだ図を移動中です。");
    updateDragPreview();
    return;
  }

  if (state.drag.type === "face-transform") {
    if (state.areaLock && state.drag.action === "scale") {
      setStatus(state.language === "en"
        ? "Keep area is on, so scaling is disabled."
        : "面積を保つONのため、拡大縮小は無効です。");
      return;
    }
    const centerScreen = imageToScreen(state.drag.center.x, state.drag.center.y);
    const angle = Math.atan2(y - centerScreen.y, x - centerScreen.x);
    const distance = Math.max(1, Math.hypot(x - centerScreen.x, y - centerScreen.y));
    const rotation = state.drag.action === "rotate" ? angle - state.drag.startAngle : 0;
    const scale = state.drag.action === "scale" ? Math.max(0.05, distance / state.drag.startDistance) : 1;
    applyFaceTransform(state.drag.snapshot, state.drag.center, rotation, scale);
    state.selectedFaceIndex = state.drag.faceIndex;
    clearSelectedEdges();
    setStatus(state.drag.action === "rotate" ? "選んだ図を回転中です。" : "選んだ図を拡大縮小中です。");
    updateDragPreview();
  }
}

function handlePointerUp() {
  canvas.classList.remove("is-view-panning");
  if (state.drag?.type === "pattern-circle") {
    const circleDrag = state.drag;
    state.drag = null;
    if (!circleDrag.moved || circleDrag.radius * state.view.zoom < 6) {
      setStatus(t("status.circleTooSmall"));
      draw();
      return;
    }
    pushHistory(circleDrag.before);
    createPatternCircle(circleDrag.center, circleDrag.radius);
    setStatus(t("status.circleCreated"));
    updateAll();
    return;
  }
  if (state.drag?.moved && state.drag.before) {
    pushHistory(state.drag.before);
    state.skipNextCanvasClick = false;
  }
  if (state.drag?.type === "selection-box" && state.drag.moved) {
    applyBoxSelection(state.drag);
  }
  if (state.drag?.type === "sketch-circle" && !state.drag.moved) {
    state.sketchCircles = state.sketchCircles.filter((circle) => circle.id !== state.drag.circleId);
    draw();
  }
  if (state.drag?.type === "point" && state.drag.moved) {
    const dragPointCount = state.drag.points?.length || 1;
    if (dragPointCount > 1) {
      setStatus(`${dragPointCount}点を移動しました。`);
    } else {
      const point = state.points.find((candidate) => candidate.id === state.drag.pointId);
      if (point) setStatus(`${point.name}を移動しました。`);
    }
  }
  if (state.drag?.type === "pattern" && state.drag.moved) {
    setStatus("選んだ図を移動しました。");
  }
  if (state.drag?.type === "source" && state.drag.moved) {
    setStatus(state.language === "en"
      ? "Moved the underlay. Points, lines, origin, and scale square stayed fixed."
      : "下敷きを移動しました。点・線・原点・スケール四角は固定です。");
  }
  if (state.drag?.type === "viewport-pan" && state.drag.moved) {
    setStatus(t("status.viewPanned"));
  }
  if (state.drag?.type === "face-transform" && state.drag.moved) {
    setStatus(state.drag.action === "rotate" ? "選んだ図を回転しました。" : "選んだ図を拡大縮小しました。");
  }
  if (state.drag?.type === "curve-handle" && state.drag.moved) {
    setStatus("カーブハンドルを移動しました。");
  }
  if (state.drag?.moved && state.drag.before) {
    updateAll();
  }
  window.setTimeout(() => {
    state.drag = null;
  }, 0);
}

function handleKeyDown(event) {
  if (event.code === "Space") {
    if (isTextInputActive()) return;
    event.preventDefault();
    state.spacePanActive = true;
    canvas.classList.add("is-view-panning-ready");
    return;
  }
  if (isTextInputActive()) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelectionFromKeyboard();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) redoTrace();
      else undoTrace();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      redoTrace();
      return;
    }
    if (key === "c" && selectedExplicitFaceTarget()) {
      event.preventDefault();
      copySelectedFace();
      return;
    }
    if (key === "v" && state.shapeClipboard) {
      event.preventDefault();
      pasteCopiedFace();
      return;
    }
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const selectedPoints = state.points.filter((point) => state.selected.has(point.id));
  const selectedEdgeIndices = selectedEdgeIndexList();
  const curveHandleTarget = selectedCurveHandleTarget();
  if (selectedPoints.length === 0 && selectedEdgeIndices.length === 0 && !curveHandleTarget) return;

  event.preventDefault();
  pushHistory();
  const moveAmount = Math.max(0, Number(arrowMoveInput.value) || state.arrowMoveAmount || 0);
  const unitStep = moveAmount * (event.shiftKey ? 10 : 1);
  const unitToCm = els.unit.value === "mm" ? 0.1 : 1;
  const cmStep = unitStep * unitToCm;
  const pixelStep = state.cmPerPixel ? cmStep / state.cmPerPixel : unitStep;
  const dx = event.key === "ArrowLeft" ? -pixelStep : event.key === "ArrowRight" ? pixelStep : 0;
  const directionY = state.yUp ? -1 : 1;
  const dy = event.key === "ArrowUp" ? -pixelStep * directionY : event.key === "ArrowDown" ? pixelStep * directionY : 0;

  if (curveHandleTarget) {
    moveSelectedCurveHandle(dx, dy);
    const handleLabel = curveHandleTarget.handle === "c1" ? "始点側" : "終点側";
    if (state.cmPerPixel) {
      setStatus(state.language === "en"
        ? `Moved curve handle by ${formatCalculatorNumber(unitStep)} ${els.unit.value}.`
        : `カーブハンドル（${handleLabel}）を${formatCalculatorNumber(unitStep)}${els.unit.value}移動しました。`);
    } else {
      setStatus(state.language === "en"
        ? `Moved curve handle by ${formatCalculatorNumber(unitStep)} px. Set scale to move by real units.`
        : `カーブハンドル（${handleLabel}）を${formatCalculatorNumber(unitStep)}px移動しました。実寸移動にはスケール設定が必要です。`);
    }
    updateAll();
    return;
  }

  if (selectedPoints.length > 0) {
    selectedPoints.forEach((point) => {
      point.x += dx;
      point.y += dy;
      if (state.snapToGrid) {
        const snappedPoint = snapImagePointToGrid(point);
        point.x = snappedPoint.x;
        point.y = snappedPoint.y;
      }
    });
  } else {
    const movedPointIds = new Set();
    selectedEdgeIndices.forEach((edgeIndex) => {
      const edge = state.edges[edgeIndex];
      if (!edge) return;
      [edge[0], edge[1]].forEach((pointId) => {
        if (movedPointIds.has(pointId)) return;
        const point = findPointById(pointId);
        if (!point) return;
        point.x += dx;
        point.y += dy;
        movedPointIds.add(pointId);
      });
      edge[2] = shiftedEdgeControl(edgeControl(edge), dx, dy) || edge[2];
    });
  }
  if (state.cmPerPixel) {
    setStatus(state.language === "en"
      ? `Moved selection by ${formatCalculatorNumber(unitStep)} ${els.unit.value}.`
      : `選択中の要素を${formatCalculatorNumber(unitStep)}${els.unit.value}移動しました。`);
  } else {
    setStatus(state.language === "en"
      ? `Moved selection by ${formatCalculatorNumber(unitStep)} px. Set scale to move by real units.`
      : `選択中の要素を${formatCalculatorNumber(unitStep)}px移動しました。実寸移動にはスケール設定が必要です。`);
  }
  updateAll();
}

function handleKeyUp(event) {
  if (event.code !== "Space") return;
  state.spacePanActive = false;
  canvas.classList.remove("is-view-panning-ready");
}

function handleWheel(event) {
  if (!state.image) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const factor = event.deltaY < 0 ? 1.08 : 0.92;

  if (state.mode === "source") {
    const before = snapshotTrace();
    const changed = scaleSourceUnderlayAt(screen, factor);
    if (!changed) return;
    pushHistory(before);
    setStatus(state.language === "en"
      ? `Underlay scale: ${Math.round(state.sourceScale * 100)}%. Points, lines, origin, and scale square stay fixed.`
      : `下敷き倍率: ${Math.round(state.sourceScale * 100)}%。点・線・原点・スケール四角は固定です。`);
    updateExports();
    draw();
    return;
  }

  state.fitViewBefore = null;
  updateFitButton();
  const before = screenToImage(screen.x, screen.y);
  state.view.zoom = Math.min(12, Math.max(0.04, state.view.zoom * factor));
  state.view.x = screen.x - before.x * state.view.zoom;
  state.view.y = screen.y - before.y * state.view.zoom;
  draw();
}

function handleCanvasMouseMove(event) {
  if (state.drag) return;
  const rect = canvas.getBoundingClientRect();
  state.cursorImagePoint = screenToImage(event.clientX - rect.left, event.clientY - rect.top);
  drawLoupe();
}

function draw() {
  const size = canvasCssSize();
  updateCanvasGridBackground();
  ctx.clearRect(0, 0, size.width, size.height);

  if (state.image) {
    ctx.save();
    ctx.globalAlpha = state.imageOpacity;
    ctx.translate(state.view.x, state.view.y);
    ctx.scale(state.view.zoom, state.view.zoom);
    const sourceRect = sourceImageRect();
    ctx.drawImage(state.image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
    ctx.restore();
  }

  drawSketchGuides();
  drawPatternCirclePreview();
  drawFaces();
  drawDxfOriginalGuides();
  if (state.showGuides) {
    drawOrigin();
    drawAreaLockGuides();
    drawAreaLabels();
    drawCalibration();
  }
  drawEdges();
  if (state.showGuides) {
    drawRightAngleMarks();
    drawCurveHandles();
    drawFaceTransformHandles();
    drawPoints();
    if (state.showScaleReference) drawScaleReferenceSquare();
  }
  drawSelectionBox();
  drawLoupe();
}

function drawDxfOriginalGuides() {
  if (!dxfOriginalGuideToggle?.checked || state.dxfGuidePaths.length === 0) return;
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(88, 214, 255, 0.72)";
  ctx.lineWidth = 1.4;
  state.dxfGuidePaths.forEach((path) => {
    if (!Array.isArray(path) || path.length < 2) return;
    ctx.beginPath();
    path.forEach((point, index) => {
      const screen = imageToScreen(point.x, point.y);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
  });
  ctx.restore();
}

function drawSketchGuides() {
  if (state.sketchStrokes.length === 0 && state.sketchCircles.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(214, 218, 224, 0.58)";
  ctx.fillStyle = "rgba(214, 218, 224, 0.58)";
  ctx.lineWidth = 2.2;
  state.sketchCircles.forEach((circle) => {
    if (!Number.isFinite(circle.cx) || !Number.isFinite(circle.cy) || !Number.isFinite(circle.radius)) return;
    if (circle.radius <= 0) return;
    const center = imageToScreen(circle.cx, circle.cy);
    ctx.beginPath();
    ctx.arc(center.x, center.y, circle.radius * state.view.zoom, 0, Math.PI * 2);
    ctx.stroke();
  });
  state.sketchStrokes.forEach((stroke) => {
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    if (points.length === 0) return;
    const first = imageToScreen(points[0].x, points[0].y);
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    points.slice(1).forEach((point) => {
      const screen = imageToScreen(point.x, point.y);
      ctx.lineTo(screen.x, screen.y);
    });
    ctx.stroke();
  });
  ctx.restore();
}

function drawPatternCirclePreview() {
  if (state.drag?.type !== "pattern-circle" || state.drag.radius <= 0) return;
  const center = imageToScreen(state.drag.center.x, state.drag.center.y);
  const radius = state.drag.radius * state.view.zoom;
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = DRAW_COLORS.line;
  ctx.fillStyle = "rgba(242, 192, 55, 0.12)";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = DRAW_COLORS.selected;
  ctx.fill();
  ctx.strokeStyle = DRAW_COLORS.pointStroke;
  ctx.stroke();
  ctx.restore();
}

function drawSelectionBox() {
  if (state.drag?.type !== "selection-box") return;
  const box = screenBoxFromDrag(state.drag);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 1 || height < 1) return;

  ctx.save();
  ctx.fillStyle = "rgba(242, 192, 55, 0.12)";
  ctx.strokeStyle = "rgba(242, 192, 55, 0.92)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.fillRect(box.minX, box.minY, width, height);
  ctx.strokeRect(box.minX, box.minY, width, height);
  ctx.restore();
}

function selectedFaceTransformGeometry() {
  const target = selectedExplicitFaceTarget();
  if (!target) return null;
  const outline = faceOutlineImagePoints(target.face);
  if (outline.length < 3) return null;

  const screens = outline.map((point) => imageToScreen(point.x, point.y));
  const minX = Math.min(...screens.map((point) => point.x));
  const maxX = Math.max(...screens.map((point) => point.x));
  const minY = Math.min(...screens.map((point) => point.y));
  const maxY = Math.max(...screens.map((point) => point.y));
  const centerImage = polygonCentroidFromPoints(target.face.map((id) => findPointById(id)).filter(Boolean));
  const center = imageToScreen(centerImage.x, centerImage.y);
  const rotate = { x: (minX + maxX) / 2, y: minY - 44 };
  const scaleHandles = [
    { key: "nw", x: minX - FACE_HANDLE_OUTSET, y: minY - FACE_HANDLE_OUTSET },
    { key: "ne", x: maxX + FACE_HANDLE_OUTSET, y: minY - FACE_HANDLE_OUTSET },
    { key: "se", x: maxX + FACE_HANDLE_OUTSET, y: maxY + FACE_HANDLE_OUTSET },
    { key: "sw", x: minX - FACE_HANDLE_OUTSET, y: maxY + FACE_HANDLE_OUTSET },
  ];

  return { target, centerImage, center, box: { minX, minY, maxX, maxY }, rotate, scaleHandles };
}

function drawFaceTransformHandles() {
  if (state.mode !== "select") return;
  if (state.selectedEdgeIndex !== null) return;
  const geometry = selectedFaceTransformGeometry();
  if (!geometry) return;
  const { box, center, rotate, scaleHandles } = geometry;
  const selectedPointIds = [...state.selected].filter((id) => state.points.some((point) => point.id === id));
  const isFaceSelection = geometry.target.face.length > 0
    && geometry.target.face.every((id) => state.selected.has(id))
    && selectedPointIds.length === geometry.target.face.length;
  if (selectedPointIds.length > 0 && !isFaceSelection) return;

  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = DRAW_COLORS.guide;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  ctx.beginPath();
  ctx.moveTo((box.minX + box.maxX) / 2, box.minY);
  ctx.lineTo(rotate.x, rotate.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = DRAW_COLORS.selected;
  ctx.fillStyle = DRAW_COLORS.selected;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(center.x - 12, center.y);
  ctx.lineTo(center.x + 12, center.y);
  ctx.moveTo(center.x, center.y - 12);
  ctx.lineTo(center.x, center.y + 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
  ctx.fill();

  if (!state.areaLock) {
    scaleHandles.forEach((handle) => drawTransformHandle(handle, DRAW_COLORS.handleFill, DRAW_COLORS.handle));
  }
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = DRAW_COLORS.handleFill;
  ctx.strokeStyle = DRAW_COLORS.handle;
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, 4, 0, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();
}

function drawTransformHandle(handle, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  roundedRectPath(ctx, handle.x - 7, handle.y - 7, 14, 14, 4);
  ctx.fill();
  ctx.stroke();
}

function hitTestFaceTransformHandle(screenX, screenY) {
  if (state.mode !== "select" && state.mode !== "pan") return null;
  const geometry = selectedFaceTransformGeometry();
  if (!geometry) return null;

  if (Math.hypot(screenX - geometry.rotate.x, screenY - geometry.rotate.y) <= FACE_HANDLE_HIT_RADIUS) {
    return { type: "rotate", geometry };
  }

  if (!state.areaLock) {
    const scaleHandle = geometry.scaleHandles.find((handle) => (
      Math.hypot(screenX - handle.x, screenY - handle.y) <= FACE_HANDLE_HIT_RADIUS
    ));
    if (scaleHandle) return { type: "scale", handle: scaleHandle.key, geometry };
  }
  return null;
}

function drawCurveHandles() {
  if (state.selectedEdgeIndex === null) return;
  const edge = state.edges[state.selectedEdgeIndex];
  const controls = edgeCubicControls(edge || []);
  if (!edge || !controls) return;
  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return;

  const a = imageToScreen(from.x, from.y);
  const b = imageToScreen(to.x, to.y);
  const c1 = imageToScreen(controls.c1.x, controls.c1.y);
  const c2 = imageToScreen(controls.c2.x, controls.c2.y);

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = DRAW_COLORS.guide;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const activeHandle = state.selectedCurveHandle?.edgeIndex === state.selectedEdgeIndex
    ? state.selectedCurveHandle.handle
    : null;
  drawHandleNode(c1, activeHandle === "c1" ? "#1d6eff" : DRAW_COLORS.handle, activeHandle === "c1");
  drawHandleNode(c2, activeHandle === "c2" ? "#1d6eff" : DRAW_COLORS.handle, activeHandle === "c2");
  ctx.restore();
}

function drawHandleNode(screen, color, active = false) {
  if (active) {
    ctx.strokeStyle = "rgba(29, 110, 255, 0.35)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    roundedRectPath(ctx, screen.x - 10, screen.y - 10, 20, 20, 7);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 4 : 3;
  ctx.beginPath();
  roundedRectPath(ctx, screen.x - 7, screen.y - 7, 14, 14, 4);
  ctx.fill();
  ctx.stroke();
}

function drawAreaLabels() {
  if (state.faces.length === 0) return;
  const scale = state.cmPerPixel || 1;
  const factor = unitFactor();
  const areaFactor = scale * scale * factor * factor;
  const unit = `${els.unit.value}²`;

  ctx.save();
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  state.faces.forEach((face) => {
    const hatchPoints = faceOutlineImagePoints(face);
    if (hatchPoints.length < 3) return;
    const area = polygonAreaFromPoints(hatchPoints) * areaFactor;
    const centroid = polygonCentroidFromPoints(hatchPoints);
    const screen = imageToScreen(centroid.x, centroid.y);
    const label = `${roundCoord(area)} ${unit}`;
    const width = ctx.measureText(label).width + 14;
    const height = 24;

    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    ctx.strokeStyle = "rgba(110, 118, 128, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundedRectPath(ctx, screen.x - width / 2, screen.y - height / 2, width, height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4d5966";
    ctx.fillText(label, screen.x, screen.y + 0.5);
  });
  ctx.restore();
}

function drawAreaLockGuides() {
  if (!state.areaLock) return;
  const guidePoints = state.points.filter((point) => state.selected.has(point.id));
  if (state.drag?.type === "point" && !guidePoints.some((point) => point.id === state.drag.pointId)) {
    const dragPoint = state.points.find((point) => point.id === state.drag.pointId);
    if (dragPoint) guidePoints.push(dragPoint);
  }
  if (guidePoints.length === 0) return;

  const size = canvasCssSize();
  const span = Math.max(size.width, size.height);
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(110, 118, 128, 0.65)";
  guidePoints.forEach((point) => {
    const constraint = getAreaLockConstraint(point.id);
    if (!constraint) return;
    const center = imageToScreen(point.x, point.y);
    ctx.beginPath();
    ctx.moveTo(center.x - constraint.ux * span, center.y - constraint.uy * span);
    ctx.lineTo(center.x + constraint.ux * span, center.y + constraint.uy * span);
    ctx.stroke();
  });
  ctx.restore();
}

function drawLoupe() {
  const width = els.loupeCanvas.width;
  const height = els.loupeCanvas.height;
  const focus = currentLoupePoint();
  loupeCtx.clearRect(0, 0, width, height);
  loupeCtx.fillStyle = DRAW_COLORS.loupeBg;
  loupeCtx.fillRect(0, 0, width, height);

  if (!state.image || !focus) {
    loupeCtx.fillStyle = "#67707d";
    loupeCtx.font = "14px sans-serif";
    loupeCtx.fillText("Move cursor over canvas", 24, 92);
    els.loupeCoords.textContent = "x -- / y --";
    return;
  }

  const zoom = state.loupeZoom;
  els.loupeScale.textContent = `${zoom}x`;
  loupeCtx.save();
  loupeCtx.imageSmoothingEnabled = false;
  loupeCtx.translate(width / 2, height / 2);
  loupeCtx.scale(zoom, zoom);
  loupeCtx.translate(-focus.x, -focus.y);
  const sourceRect = sourceImageRect();
  loupeCtx.drawImage(state.image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height);
  loupeCtx.restore();

  drawLoupeFaces(focus, zoom, width, height);
  drawLoupeEdges(focus, zoom, width, height);
  drawLoupePoints(focus, zoom, width, height);
  drawLoupeCrosshair(width, height);

  const coords = pointToPattern(focus);
  els.loupeCoords.textContent = `x ${coords.x} / y ${coords.y} ${els.unit.value}`;
}

function loupeTransform(point, focus, zoom, width, height) {
  return {
    x: width / 2 + (point.x - focus.x) * zoom,
    y: height / 2 + (point.y - focus.y) * zoom,
  };
}

function drawLoupeFaces(focus, zoom, width, height) {
  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  loupeCtx.save();
  state.faces.forEach((face) => {
    const facePoints = face.map((id) => pointMap.get(id)).filter(Boolean);
    const hatchPoints = faceOutlineImagePoints(face);
    if (facePoints.length < 3 || hatchPoints.length < 3) return;
    loupeCtx.beginPath();
    facePoints.forEach((point, index) => {
      const screen = loupeTransform(point, focus, zoom, width, height);
      if (index === 0) loupeCtx.moveTo(screen.x, screen.y);
      else loupeCtx.lineTo(screen.x, screen.y);
    });
    loupeCtx.closePath();
    loupeCtx.fillStyle = "rgba(99, 176, 166, 0.18)";
    loupeCtx.fill();
  });
  loupeCtx.restore();
}

function drawLoupeEdges(focus, zoom, width, height) {
  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  loupeCtx.save();
  loupeCtx.strokeStyle = DRAW_COLORS.line;
  loupeCtx.lineWidth = 2;
  state.edges.forEach((edge, index) => {
    const [fromId, toId] = edge;
    const from = pointMap.get(fromId);
    const to = pointMap.get(toId);
    if (!from || !to) return;
    const a = loupeTransform(from, focus, zoom, width, height);
    const b = loupeTransform(to, focus, zoom, width, height);
    loupeCtx.beginPath();
    loupeCtx.moveTo(a.x, a.y);
    const controls = edgeCubicControls(edge);
    if (controls) {
      const c1 = loupeTransform(controls.c1, focus, zoom, width, height);
      const c2 = loupeTransform(controls.c2, focus, zoom, width, height);
      loupeCtx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    } else {
      loupeCtx.lineTo(b.x, b.y);
    }
    loupeCtx.stroke();
  });
  loupeCtx.restore();
}

function drawLoupePoints(focus, zoom, width, height) {
  if (!state.showGuides) {
    return;
  }

  loupeCtx.save();
  state.points.forEach((point) => {
    const screen = loupeTransform(point, focus, zoom, width, height);
    const isSelected = state.selected.has(point.id);
    loupeCtx.fillStyle = isSelected ? DRAW_COLORS.selected : "#f8f8f6";
    loupeCtx.strokeStyle = DRAW_COLORS.pointStroke;
    loupeCtx.lineWidth = 1.6;
    loupeCtx.beginPath();
    loupeCtx.arc(screen.x, screen.y, isSelected ? 4.5 : 4, 0, Math.PI * 2);
    loupeCtx.fill();
    loupeCtx.stroke();
  });
  loupeCtx.restore();
}

function drawLoupeCrosshair(width, height) {
  loupeCtx.save();
  loupeCtx.strokeStyle = DRAW_COLORS.loupeTarget;
  loupeCtx.lineWidth = 2;
  loupeCtx.beginPath();
  loupeCtx.moveTo(width / 2 - 18, height / 2);
  loupeCtx.lineTo(width / 2 + 18, height / 2);
  loupeCtx.moveTo(width / 2, height / 2 - 18);
  loupeCtx.lineTo(width / 2, height / 2 + 18);
  loupeCtx.stroke();
  loupeCtx.beginPath();
  loupeCtx.arc(width / 2, height / 2, 5, 0, Math.PI * 2);
  loupeCtx.stroke();
  loupeCtx.fillStyle = DRAW_COLORS.loupeTarget;
  loupeCtx.beginPath();
  loupeCtx.arc(width / 2, height / 2, 2, 0, Math.PI * 2);
  loupeCtx.fill();
  loupeCtx.restore();
}

function changeLoupeZoom(delta) {
  const currentIndex = LOUPE_ZOOMS.indexOf(state.loupeZoom);
  const safeIndex = currentIndex === -1 ? LOUPE_ZOOMS.length - 1 : currentIndex;
  const nextIndex = Math.min(LOUPE_ZOOMS.length - 1, Math.max(0, safeIndex + delta));
  state.loupeZoom = LOUPE_ZOOMS[nextIndex];
  drawLoupe();
}

function clearSketchGuides() {
  if (state.sketchStrokes.length === 0 && state.sketchCircles.length === 0) {
    setStatus(t("status.noSketch"));
    return;
  }
  pushHistory();
  state.sketchStrokes = [];
  state.sketchCircles = [];
  setStatus(t("status.sketchCleared"));
  updateAll();
}

function toggleAreaLock() {
  state.areaLock = !state.areaLock;
  areaLockButton.classList.toggle("active", state.areaLock);
  setStatus(state.areaLock ? "面積を保つ: オン" : "面積を保つ: オフ");
  draw();
}

function toggleGuides() {
  state.showGuides = !state.showGuides;
  guideToggleButton.textContent = state.showGuides ? t("action.hideGuides") : t("action.showGuides");
  guideToggleButton.classList.toggle("active", !state.showGuides);
  setStatus(
    state.showGuides
      ? (state.language === "en" ? "Guides, points, and handles are visible." : "点・ハンドル・補助線を表示しました。")
      : (state.language === "en" ? "Guides, points, and handles are hidden." : "点・ハンドル・補助線を隠しました。図形の形だけ確認できます。")
  );
  draw();
}

function togglePointLabels() {
  state.showPointLabels = !state.showPointLabels;
  localStorage.setItem("quackTraceShowPointLabels", state.showPointLabels ? "true" : "false");
  pointLabelToggleButton.textContent = state.showPointLabels ? t("action.hidePointLabels") : t("action.showPointLabels");
  pointLabelToggleButton.classList.toggle("active", !state.showPointLabels);
  setStatus(
    state.showPointLabels
      ? (state.language === "en" ? "Point names are visible." : "ポイント番号を表示しました。")
      : (state.language === "en" ? "Point names are hidden. Point dots remain visible." : "ポイント番号を非表示にしました。点の丸は表示したままです。")
  );
  draw();
}

function toggleCanvasGrid() {
  state.showCanvasGrid = !state.showCanvasGrid;
  canvasGridToggleButton.textContent = state.showCanvasGrid ? t("action.hideCanvasGrid") : t("action.showCanvasGrid");
  canvasGridToggleButton.classList.toggle("active", !state.showCanvasGrid);
  setStatus(
    state.showCanvasGrid
      ? (state.language === "en" ? "Grid is visible." : "方眼を表示しました。")
      : (state.language === "en" ? "Grid is hidden." : "方眼を非表示にしました。")
  );
  draw();
}

function toggleGridSnap() {
  state.snapToGrid = !state.snapToGrid;
  localStorage.setItem("quackTraceSnapToGrid", state.snapToGrid ? "true" : "false");
  gridSnapToggleButton.textContent = state.snapToGrid ? t("action.snapOn") : t("action.snapOff");
  gridSnapToggleButton.classList.toggle("active", state.snapToGrid);
  setStatus(
    state.snapToGrid
      ? (state.language === "en" ? "Grid snap is on. Points snap to 1 cm squares." : "スナップON。点が1cm小マスに吸着します。")
      : (state.language === "en" ? "Grid snap is off." : "スナップOFF。点を自由に置けます。")
  );
}

function toggleScaleReference() {
  state.showScaleReference = !state.showScaleReference;
  scaleReferenceToggleButton.textContent = state.showScaleReference ? t("action.hideScaleReference") : t("action.showScaleReference");
  scaleReferenceToggleButton.classList.toggle("active", !state.showScaleReference);
  setStatus(
    state.showScaleReference
      ? (state.language === "en" ? "Scale square is visible." : "スケール四角を表示しました。")
      : (state.language === "en" ? "Scale square is hidden." : "スケール四角を隠しました。")
  );
  draw();
}

function straightenSelectedEdge() {
  if (state.selectedEdgeIndex === null || !state.edges[state.selectedEdgeIndex]) {
    setStatus("直線に戻したい線を先に選んでください。");
    return;
  }
  pushHistory();
  state.edges[state.selectedEdgeIndex].splice(2, 1);
  setStatus("選択した線を直線に戻しました。");
  updateAll();
}

function alignSelectedEdge(axis) {
  if (state.selectedEdgeIndex === null || !state.edges[state.selectedEdgeIndex]) {
    setStatus("水平・垂直にしたい線を先に選んでください。");
    return;
  }
  const edge = state.edges[state.selectedEdgeIndex];
  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return;

  pushHistory();
  if (axis === "horizontal") {
    const delta = from.y - to.y;
    to.y = from.y;
    if (edge[2]?.c1 && edge[2]?.c2) {
      edge[2].c1.y += delta;
      edge[2].c2.y += delta;
    }
    setStatus("選択した線を水平にしました。");
  } else {
    const delta = from.x - to.x;
    to.x = from.x;
    if (edge[2]?.c1 && edge[2]?.c2) {
      edge[2].c1.x += delta;
      edge[2].c2.x += delta;
    }
    setStatus("選択した線を垂直にしました。");
  }
  updateAll();
}

function selectedFaceTarget() {
  if (state.selectedFaceIndex !== null && state.faces[state.selectedFaceIndex]) {
    return { index: state.selectedFaceIndex, face: state.faces[state.selectedFaceIndex] };
  }

  const selectedFaces = state.faces
    .map((face, index) => ({ face, index }))
    .filter(({ face }) => face.length >= 3 && face.every((id) => state.selected.has(id)));
  if (selectedFaces.length > 0) return selectedFaces[0];

  if (state.faces.length === 1) return { index: 0, face: state.faces[0] };
  return null;
}

function transformImagePoint(point, center, rotation, scale) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: center.x + (dx * cos - dy * sin) * scale,
    y: center.y + (dx * sin + dy * cos) * scale,
  };
}

function faceEdgeIndexes(face) {
  const facePointIds = new Set(face);
  return state.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => facePointIds.has(edge[0]) && facePointIds.has(edge[1]))
    .map(({ index }) => index);
}

function faceTransformSnapshot(face) {
  const facePointIds = new Set(face);
  return {
    points: state.points
      .filter((point) => facePointIds.has(point.id))
      .map((point) => ({ id: point.id, x: point.x, y: point.y })),
    edgeControls: faceEdgeIndexes(face).map((index) => ({
      index,
      control: structuredClone(edgeControl(state.edges[index])),
    })),
  };
}

function applyFaceTransform(snapshot, center, rotation, scale) {
  snapshot.points.forEach((source) => {
    const point = findPointById(source.id);
    if (!point) return;
    const next = transformImagePoint(source, center, rotation, scale);
    point.x = next.x;
    point.y = next.y;
  });

  snapshot.edgeControls.forEach(({ index, control }) => {
    const edge = state.edges[index];
    if (!edge || !control) return;
    const nextControl = structuredClone(control);
    if (nextControl.c1 && nextControl.c2) {
      nextControl.c1 = transformImagePoint(nextControl.c1, center, rotation, scale);
      nextControl.c2 = transformImagePoint(nextControl.c2, center, rotation, scale);
      edge[2] = nextControl;
    } else if (typeof nextControl.x === "number" && typeof nextControl.y === "number") {
      edge[2] = transformImagePoint(nextControl, center, rotation, scale);
    }
  });
}

function selectedExplicitFaceTarget() {
  if (state.selectedFaceIndex !== null && state.faces[state.selectedFaceIndex]) {
    return { index: state.selectedFaceIndex, face: state.faces[state.selectedFaceIndex] };
  }

  const selectedFaces = state.faces
    .map((face, index) => ({ face, index }))
    .filter(({ face }) => face.length >= 3 && face.every((id) => state.selected.has(id)));
  return selectedFaces[0] || null;
}

function faceBoundaryEdges(face) {
  return face
    .map((fromId, index) => {
      const toId = face[(index + 1) % face.length];
      const edgeIndex = findEdgeIndexBetween(fromId, toId);
      return {
        fromId,
        toId,
        edgeIndex,
        edge: edgeIndex >= 0 ? state.edges[edgeIndex] : null,
      };
    })
    .filter(({ edge }) => edge);
}

function mirrorPointX(point, centerX) {
  return { x: centerX - (point.x - centerX), y: point.y };
}

function mirrorEdgeControlX(control, centerX) {
  if (!control) return null;
  const mirrored = structuredClone(control);
  if (mirrored.c1 && mirrored.c2) {
    mirrored.c1 = mirrorPointX(mirrored.c1, centerX);
    mirrored.c2 = mirrorPointX(mirrored.c2, centerX);
    return mirrored;
  }
  if (typeof mirrored.x === "number" && typeof mirrored.y === "number") {
    return mirrorPointX(mirrored, centerX);
  }
  return mirrored;
}

function shapePasteOffset() {
  if (state.cmPerPixel) return 2 / state.cmPerPixel;
  return 32 / Math.max(0.2, state.view.zoom);
}

function copySelectedFace() {
  const target = selectedExplicitFaceTarget();
  if (!target) {
    setStatus(state.language === "en"
      ? "Select a closed shape before copying."
      : "コピーしたい閉じた図を先に選択してください。");
    updateFaceActionButtons();
    return;
  }

  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  const sourcePoints = target.face.map((id) => pointMap.get(id)).filter(Boolean);
  state.shapeClipboard = {
    points: sourcePoints.map((point) => ({
      sourceId: point.id,
      x: point.x,
      y: point.y,
    })),
    face: [...target.face],
    edges: faceBoundaryEdges(target.face).map(({ fromId, toId, edge }) => {
      const directedControl = directedEdgeControls(edge, fromId, toId) || edgeControl(edge);
      return {
        fromId,
        toId,
        control: directedControl ? structuredClone(directedControl) : null,
      };
    }),
    pasteCount: 0,
  };
  setStatus(state.language === "en" ? "Copied the selected shape." : "選択した図をコピーしました。");
  updateFaceActionButtons();
}

function pasteCopiedFace() {
  if (!state.shapeClipboard) {
    setStatus(state.language === "en" ? "Copy a closed shape first." : "先に閉じた図をコピーしてください。");
    updateFaceActionButtons();
    return;
  }

  pushHistory();
  const pasteCount = state.shapeClipboard.pasteCount + 1;
  state.shapeClipboard.pasteCount = pasteCount;
  const offset = shapePasteOffset() * pasteCount;
  const idMap = new Map();
  const newPoints = state.shapeClipboard.points.map((source) => {
    const id = crypto.randomUUID();
    idMap.set(source.sourceId, id);
    return {
      id,
      name: nextPointName(),
      x: source.x + offset,
      y: source.y + offset,
    };
  });

  state.points.push(...newPoints);
  state.shapeClipboard.edges.forEach(({ fromId, toId, control }) => {
    const nextFrom = idMap.get(fromId);
    const nextTo = idMap.get(toId);
    if (!nextFrom || !nextTo) return;
    const nextControl = shiftedEdgeControl(control, offset, offset);
    state.edges.push(nextControl ? [nextFrom, nextTo, nextControl] : [nextFrom, nextTo]);
  });

  const newFace = state.shapeClipboard.face.map((id) => idMap.get(id)).filter(Boolean);
  if (newFace.length >= 3) {
    state.selectedFaceIndex = state.faces.push(newFace) - 1;
    state.selected = new Set(newFace);
  }
  state.currentPathLast = null;
  state.currentPathIds = [];
  clearSelectedEdges();
  updateAll();
  setStatus(state.language === "en" ? "Pasted the copied shape." : "コピーした図を貼り付けました。");
}

function flipSelectedFaceHorizontal() {
  const target = selectedExplicitFaceTarget();
  if (!target) {
    setStatus(state.language === "en"
      ? "Select a closed shape before flipping."
      : "左右反転したい閉じた図を先に選択してください。");
    updateFaceActionButtons();
    return;
  }

  const points = target.face.map((id) => findPointById(id)).filter(Boolean);
  if (points.length < 3) return;
  pushHistory();
  const center = polygonCentroidFromPoints(points);
  const facePointIds = new Set(target.face);
  state.points.forEach((point) => {
    if (!facePointIds.has(point.id)) return;
    point.x = center.x - (point.x - center.x);
  });
  faceBoundaryEdges(target.face).forEach(({ edge }) => {
    const mirrored = mirrorEdgeControlX(edgeControl(edge), center.x);
    if (mirrored) edge[2] = mirrored;
  });
  updateAll();
  setStatus(state.language === "en" ? "Flipped the selected shape." : "選択した図を左右反転しました。");
}

function updateFaceActionButtons() {
  const hasSelectedFace = Boolean(selectedExplicitFaceTarget());
  flipFaceButton.disabled = !hasSelectedFace;
}

function deleteSelectedFace() {
  const target = selectedExplicitFaceTarget();
  if (!target) {
    setStatus("削除したい閉じた図を、先に「選択・移動」で選んでください。");
    return;
  }

  pushHistory();

  const removedFaceIds = new Set(target.face);
  const remainingFaces = state.faces.filter((_, index) => index !== target.index);
  const stillUsedPointIds = new Set(remainingFaces.flat());
  const pointIdsToRemove = new Set([...removedFaceIds].filter((id) => !stillUsedPointIds.has(id)));

  state.faces = remainingFaces;
  state.edges = state.edges.filter(([fromId, toId]) => {
    if (pointIdsToRemove.has(fromId) || pointIdsToRemove.has(toId)) return false;
    return !(removedFaceIds.has(fromId) && removedFaceIds.has(toId));
  });
  state.points = state.points.filter((point) => !pointIdsToRemove.has(point.id));
  ensureFaceBoundaryEdges();
  state.currentPathIds = state.currentPathIds.filter((id) => !pointIdsToRemove.has(id));
  if (state.currentPathLast && pointIdsToRemove.has(state.currentPathLast)) state.currentPathLast = null;
  if (state.lastPointClick?.id && pointIdsToRemove.has(state.lastPointClick.id)) state.lastPointClick = null;

  state.selected.clear();
  clearSelectedEdges();
  state.selectedFaceIndex = null;

  setStatus("選択した図を削除しました。");
  updateAll();
}

function deleteSelectedPoints() {
  const selectedPointIds = new Set([...state.selected].filter((id) => state.points.some((point) => point.id === id)));
  if (selectedPointIds.size === 0) return false;

  pushHistory();
  state.points = state.points.filter((point) => !selectedPointIds.has(point.id));
  state.edges = state.edges.filter(([fromId, toId]) => !selectedPointIds.has(fromId) && !selectedPointIds.has(toId));
  state.faces = state.faces
    .map((face) => face.filter((pointId) => !selectedPointIds.has(pointId)))
    .filter((face) => face.length >= 3);
  ensureFaceBoundaryEdges();
  state.currentPathIds = state.currentPathIds.filter((pointId) => !selectedPointIds.has(pointId));
  if (state.currentPathLast && selectedPointIds.has(state.currentPathLast)) state.currentPathLast = null;
  if (state.lastPointClick?.id && selectedPointIds.has(state.lastPointClick.id)) state.lastPointClick = null;
  state.selected.clear();
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  setStatus(t("delete.points"));
  updateAll();
  return true;
}

function deleteSelectedEdges() {
  const indices = selectedEdgeIndexList().sort((a, b) => b - a);
  if (indices.length === 0) return false;
  const boundaryKeys = faceBoundaryPairKeys();
  const removableIndices = indices.filter((index) => !boundaryKeys.has(edgePairKey(state.edges[index])));
  if (removableIndices.length === 0) {
    setStatus(t("delete.faceBoundary"));
    return true;
  }

  pushHistory();
  removableIndices.forEach((index) => state.edges.splice(index, 1));
  ensureFaceBoundaryEdges();
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  setStatus(removableIndices.length === indices.length ? t("delete.edges") : t("delete.faceBoundary"));
  updateAll();
  return true;
}

function deleteSelectionFromKeyboard() {
  if (selectedExplicitFaceTarget()) {
    deleteSelectedFace();
    return;
  }
  if (deleteSelectedPoints()) return;
  if (deleteSelectedEdges()) return;
  setStatus(t("delete.none"));
}

function setImageOpacity(value) {
  state.imageOpacity = Math.min(1, Math.max(0, Number(value)));
  opacityInput.value = String(state.imageOpacity);
  opacityValue.textContent = `${Math.round(state.imageOpacity * 100)}%`;
  draw();
}

function setShapeOpacity(value) {
  state.shapeOpacity = Math.min(1, Math.max(0, Number(value)));
  shapeOpacityInput.value = String(state.shapeOpacity);
  shapeOpacityValue.textContent = `${Math.round(state.shapeOpacity * 100)}%`;
  draw();
}

function setGridOpacity(value) {
  state.gridOpacity = Math.min(1, Math.max(0, Number(value)));
  gridOpacityInput.value = String(state.gridOpacity);
  gridOpacityValue.textContent = `${Math.round(state.gridOpacity * 100)}%`;
  localStorage.setItem("quackTraceGridOpacity", String(state.gridOpacity));
  updateCanvasGridBackground();
}

function setPointSize(value) {
  state.pointSize = Math.min(1, Math.max(0, Number(value)));
  pointSizeInput.value = String(state.pointSize);
  pointSizeValue.textContent = `${Math.round(state.pointSize * 100)}%`;
  localStorage.setItem("quackTracePointSize", String(state.pointSize));
  draw();
}

function faceFillStyle() {
  const [r, g, b] = DRAW_COLORS.faceFill;
  return `rgba(${r}, ${g}, ${b}, ${state.shapeOpacity})`;
}

function drawFaces() {
  if (state.faces.length === 0) return;
  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  ctx.save();
  state.faces.forEach((face) => {
    const facePoints = face.map((id) => pointMap.get(id)).filter(Boolean);
    if (facePoints.length < 3) return;

    ctx.beginPath();
    face.forEach((pointId, index) => {
      const point = pointMap.get(pointId);
      if (!point) return;
      const screen = imageToScreen(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(screen.x, screen.y);
        return;
      }
      const previousId = face[index - 1];
      const control = edgeControlForDirection(previousId, pointId);
      if (control) {
        const c1 = imageToScreen(control.c1.x, control.c1.y);
        const c2 = imageToScreen(control.c2.x, control.c2.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    });
    const firstId = face[0];
    const lastId = face[face.length - 1];
    const first = pointMap.get(firstId);
    const closeControl = edgeControlForDirection(lastId, firstId);
    if (first) {
      const firstScreen = imageToScreen(first.x, first.y);
      if (closeControl) {
        const c1 = imageToScreen(closeControl.c1.x, closeControl.c1.y);
        const c2 = imageToScreen(closeControl.c2.x, closeControl.c2.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, firstScreen.x, firstScreen.y);
      } else {
        ctx.lineTo(firstScreen.x, firstScreen.y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = faceFillStyle();
    ctx.fill();
  });
  ctx.restore();
}

function drawFaceMistGradient(facePoints) {
  const screens = facePoints.map((point) => imageToScreen(point.x, point.y));
  const minX = Math.min(...screens.map((point) => point.x));
  const maxX = Math.max(...screens.map((point) => point.x));
  const minY = Math.min(...screens.map((point) => point.y));
  const maxY = Math.max(...screens.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const pad = Math.max(width, height) * 0.18;

  const wash = ctx.createLinearGradient(minX, minY, maxX, maxY);
  wash.addColorStop(0, "rgba(255, 111, 168, 0.22)");
  wash.addColorStop(0.32, "rgba(118, 216, 255, 0.2)");
  wash.addColorStop(0.68, "rgba(245, 245, 142, 0.2)");
  wash.addColorStop(1, "rgba(106, 118, 255, 0.2)");
  ctx.fillStyle = wash;
  ctx.fillRect(minX - pad, minY - pad, width + pad * 2, height + pad * 2);

  [
    { x: 0.2, y: 0.22, r: 0.58, color: "255, 92, 150" },
    { x: 0.75, y: 0.24, r: 0.6, color: "73, 108, 255" },
    { x: 0.32, y: 0.78, r: 0.64, color: "103, 232, 219" },
    { x: 0.72, y: 0.72, r: 0.52, color: "255, 238, 116" },
  ].forEach((blob) => {
    const cx = minX + width * blob.x;
    const cy = minY + height * blob.y;
    const radius = Math.max(width, height) * blob.r;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${blob.color}, 0.28)`);
    gradient.addColorStop(0.52, `rgba(${blob.color}, 0.12)`);
    gradient.addColorStop(1, `rgba(${blob.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(minX - pad, minY - pad, width + pad * 2, height + pad * 2);
  });
}

function drawHatchLines(facePoints) {
  const screens = facePoints.map((point) => imageToScreen(point.x, point.y));
  const minX = Math.min(...screens.map((point) => point.x));
  const maxX = Math.max(...screens.map((point) => point.x));
  const minY = Math.min(...screens.map((point) => point.y));
  const maxY = Math.max(...screens.map((point) => point.y));
  const span = maxX - minX + maxY - minY;

  ctx.strokeStyle = "rgba(17, 107, 117, 0.16)";
  ctx.lineWidth = 0.9;
  for (let offset = -span; offset < span * 1.5; offset += 12) {
    ctx.beginPath();
    ctx.moveTo(minX + offset, maxY + 18);
    ctx.lineTo(minX + offset + span, minY - 18);
    ctx.stroke();
  }
}

function drawCalibration() {
  if (state.calibrationClicks.length === 0) return;
  if (state.cmPerPixel && state.mode !== "calibrate") return;
  const points = state.calibrationClicks.map((point) => imageToScreen(point.x, point.y));
  ctx.save();
  ctx.strokeStyle = DRAW_COLORS.selected;
  ctx.fillStyle = DRAW_COLORS.selected;
  ctx.lineWidth = 2;

  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  }

  points.forEach((point, index) => {
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    roundedRectPath(ctx, point.x - 7, point.y - 7, 14, 14, 2);
    ctx.fill();
    ctx.strokeStyle = DRAW_COLORS.selected;
    ctx.stroke();
    ctx.fillStyle = "#f2f4f8";
    ctx.font = "700 12px Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif";
    ctx.fillText(index === 0 ? "1" : "2", point.x + 10, point.y - 10);
  });

  if (points.length === 2) {
    const mid = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
    ctx.font = "700 13px Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif";
    ctx.fillStyle = "#f2f4f8";
    ctx.strokeStyle = "rgba(11, 13, 18, 0.82)";
    ctx.lineWidth = 4;
    const label = `${els.knownLength.value || "?"} ${els.unit.value}`;
    ctx.strokeText(label, mid.x + 8, mid.y - 8);
    ctx.fillText(label, mid.x + 8, mid.y - 8);
  }
  ctx.restore();
}

function drawOrigin() {
  if (!state.origin) return;
  const origin = imageToScreen(state.origin.x, state.origin.y);
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = DRAW_COLORS.originGuide;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(origin.x + 12, origin.y);
  ctx.lineTo(origin.x + 92, origin.y);
  ctx.moveTo(origin.x, origin.y - 92);
  ctx.lineTo(origin.x, origin.y - 12);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = DRAW_COLORS.origin;
  ctx.fillStyle = DRAW_COLORS.origin;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(origin.x - 18, origin.y);
  ctx.lineTo(origin.x + 18, origin.y);
  ctx.moveTo(origin.x, origin.y - 18);
  ctx.lineTo(origin.x, origin.y + 18);
  ctx.stroke();
  ctx.font = "700 11px Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(t("guide.origin"), origin.x + 10, origin.y + 10);
  ctx.restore();
}

function drawScaleReferenceSquare() {
  if (!state.cmPerPixel) return;

  const size = canvasCssSize();
  const squareSize = (10 / state.cmPerPixel) * state.view.zoom;
  if (!Number.isFinite(squareSize) || squareSize <= 0) return;

  const margin = 22;
  const labelHeight = 24;
  const maxVisibleSize = Math.min(size.width - margin * 2, size.height - margin * 2 - labelHeight);
  const displaySize = Math.max(8, Math.min(squareSize, maxVisibleSize));
  const isClamped = Math.abs(displaySize - squareSize) > 0.5;
  let x = margin;
  let y = size.height - margin - labelHeight - displaySize;

  if (state.origin) {
    const origin = imageToScreen(state.origin.x, state.origin.y);
    const anchorGap = 18;
    const anchoredX = origin.x + anchorGap;
    const anchoredY = origin.y - displaySize - anchorGap;
    const fitsHorizontally = anchoredX >= margin && anchoredX + displaySize <= size.width - margin;
    const fitsVertically = anchoredY >= margin && origin.y + labelHeight + 10 <= size.height - margin;
    if (fitsHorizontally && fitsVertically) {
      x = anchoredX;
      y = anchoredY;
    }
  }

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.strokeStyle = "rgba(242, 192, 55, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.fillRect(x, y, displaySize, displaySize);
  ctx.strokeRect(x, y, displaySize, displaySize);
  ctx.setLineDash([]);

  const label = isClamped ? t("guide.scaleReferenceClamped") : t("guide.scaleReference");
  ctx.font = "700 12px Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif";
  const labelWidth = Math.ceil(ctx.measureText(label).width + 16);
  const labelX = x + 8;
  const labelY = y + 8;
  ctx.fillStyle = "rgba(11, 13, 18, 0.68)";
  ctx.beginPath();
  roundedRectPath(ctx, labelX, labelY, labelWidth, 22, 6);
  ctx.fill();

  ctx.fillStyle = "#f2f4f8";
  ctx.fillText(label, labelX + 8, labelY + 15);
  ctx.restore();
}

function isStraightFaceCorner(previousId, currentId, nextId) {
  const previousEdge = findEdgeBetween(previousId, currentId);
  const nextEdge = findEdgeBetween(currentId, nextId);
  return previousEdge && nextEdge
    && !edgeCubicControls(previousEdge)
    && !edgeCubicControls(nextEdge);
}

function drawRightAngleMarks() {
  if (!state.cmPerPixel || state.faces.length === 0) return;

  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  const tolerance = 0.002;
  const minimumCm = 1;
  const markSize = 13;

  ctx.save();
  ctx.strokeStyle = DRAW_COLORS.rightAngle;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  state.faces.forEach((face) => {
    if (face.length < 3) return;

    face.forEach((currentId, index) => {
      const previousId = face[(index - 1 + face.length) % face.length];
      const nextId = face[(index + 1) % face.length];
      if (!isStraightFaceCorner(previousId, currentId, nextId)) return;

      const previous = pointMap.get(previousId);
      const current = pointMap.get(currentId);
      const next = pointMap.get(nextId);
      if (!previous || !current || !next) return;

      const v1 = { x: previous.x - current.x, y: previous.y - current.y };
      const v2 = { x: next.x - current.x, y: next.y - current.y };
      const len1 = Math.hypot(v1.x, v1.y);
      const len2 = Math.hypot(v2.x, v2.y);
      if (len1 * state.cmPerPixel < minimumCm || len2 * state.cmPerPixel < minimumCm) return;

      const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
      if (Math.abs(dot) > tolerance) return;

      const screenCurrent = imageToScreen(current.x, current.y);
      const screenPrevious = imageToScreen(previous.x, previous.y);
      const screenNext = imageToScreen(next.x, next.y);
      const s1 = normalizeVector({
        x: screenPrevious.x - screenCurrent.x,
        y: screenPrevious.y - screenCurrent.y,
      });
      const s2 = normalizeVector({
        x: screenNext.x - screenCurrent.x,
        y: screenNext.y - screenCurrent.y,
      });
      if (!s1 || !s2) return;

      const sizePx = Math.min(markSize, Math.max(7, Math.min(
        Math.hypot(screenPrevious.x - screenCurrent.x, screenPrevious.y - screenCurrent.y) * 0.36,
        Math.hypot(screenNext.x - screenCurrent.x, screenNext.y - screenCurrent.y) * 0.36,
      )));

      const a = {
        x: screenCurrent.x + s1.x * sizePx,
        y: screenCurrent.y + s1.y * sizePx,
      };
      const corner = {
        x: a.x + s2.x * sizePx,
        y: a.y + s2.y * sizePx,
      };
      const b = {
        x: screenCurrent.x + s2.x * sizePx,
        y: screenCurrent.y + s2.y * sizePx,
      };

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(corner.x, corner.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  });

  ctx.restore();
}

function drawEdges() {
  const pointMap = new Map(state.points.map((point) => [point.id, point]));
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  state.edges.forEach((edge, index) => {
    const [fromId, toId] = edge;
    const from = pointMap.get(fromId);
    const to = pointMap.get(toId);
    if (!from || !to) return;
    const a = imageToScreen(from.x, from.y);
    const b = imageToScreen(to.x, to.y);
    const controls = edgeCubicControls(edge);
    const isSelected =
      index === state.selectedEdgeIndex || state.selectedEdgeIndices?.has(index);
    const strokePath = () => {
      if (controls) {
        const c1 = imageToScreen(controls.c1.x, controls.c1.y);
        const c2 = imageToScreen(controls.c2.x, controls.c2.y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    };

    ctx.strokeStyle = isSelected ? DRAW_COLORS.selected : DRAW_COLORS.line;
    ctx.lineWidth = isSelected ? 3.2 : 2.4;
    if (controls) {
      const c1 = imageToScreen(controls.c1.x, controls.c1.y);
      const c2 = imageToScreen(controls.c2.x, controls.c2.y);
      strokePath();

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(110, 118, 128, 0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      ctx.restore();
    } else {
      strokePath();
    }
  });
  ctx.restore();
}

function drawPoints() {
  ctx.save();
  ctx.font = "13px Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  state.points.forEach((point, index) => {
    const screen = imageToScreen(point.x, point.y);
    const isSelected = state.selected.has(point.id);
    const pointRadius = (isSelected ? 7 : 6) * state.pointSize;
    ctx.fillStyle = isSelected ? DRAW_COLORS.selected : "#f8f8f6";
    ctx.strokeStyle = DRAW_COLORS.pointStroke;
    ctx.lineWidth = Math.max(1.2, 2.2 * state.pointSize);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, pointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!state.showPointLabels) return;
    const label = `${index + 1}:${point.name}`;
    const labelX = screen.x + Math.max(7, pointRadius + 4);
    ctx.lineWidth = 4;
    ctx.strokeStyle = DRAW_COLORS.labelUnderlay;
    ctx.strokeText(label, labelX, screen.y);
    ctx.fillStyle = DRAW_COLORS.label;
    ctx.fillText(label, labelX, screen.y);
  });
  ctx.restore();
}

function renderPointList() {
  els.pointList.innerHTML = "";
  state.points.forEach((point, index) => {
    const coords = pointToPattern(point);
    const item = document.createElement("li");
    item.className = `point-item${state.selected.has(point.id) ? " selected" : ""}`;
    item.innerHTML = `
      <span class="point-index">${index + 1}</span>
      <input class="point-name" value="${escapeHtml(point.name)}" aria-label="点名" />
      <button class="delete-point" type="button" title="削除">×</button>
      <span class="point-meta">x ${coords.x} / y ${coords.y} ${els.unit.value}</span>
    `;
    item.addEventListener("click", (event) => {
      if (event.target.matches("input, button")) return;
      if (event.shiftKey) {
        if (state.selected.has(point.id)) state.selected.delete(point.id);
        else state.selected.add(point.id);
        state.selectedFaceIndex = null;
      } else {
        state.selected.clear();
        state.selected.add(point.id);
        state.selectedFaceIndex = null;
      }
      updateAll();
    });
    item.querySelector(".point-name").addEventListener("input", (event) => {
      point.name = event.target.value;
      updateExports();
      draw();
    });
    item.querySelector(".delete-point").addEventListener("click", () => {
      deletePoint(point.id);
    });
    els.pointList.appendChild(item);
  });
}

function deletePoint(id) {
  pushHistory();
  state.points = state.points.filter((point) => point.id !== id);
  state.edges = state.edges.filter(([fromId, toId]) => fromId !== id && toId !== id);
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  state.faces = state.faces
    .map((face) => face.filter((pointId) => pointId !== id))
    .filter((face) => face.length >= 3);
  ensureFaceBoundaryEdges();
  state.selected.delete(id);
  state.currentPathIds = state.currentPathIds.filter((pointId) => pointId !== id);
  if (state.currentPathLast === id) state.currentPathLast = null;
  if (state.lastPointClick?.id === id) state.lastPointClick = null;
  updateAll();
}

function resetTrace() {
  if (hasTraceContent()) pushHistory();
  state.sketchStrokes = [];
  state.sketchCircles = [];
  state.dxfGuidePaths = [];
  state.points = [];
  state.edges = [];
  state.faces = [];
  state.selected.clear();
  state.calibrationClicks = [];
  state.currentPathLast = null;
  state.currentPathIds = [];
  state.cursorImagePoint = null;
  state.lastPointClick = null;
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  els.pointName.value = "P1";
  setStatus("点、線、面をリセットしました。");
  updateAll();
}

function connectSelected() {
  const selectedPoints = state.points.filter((point) => state.selected.has(point.id));
  if (selectedPoints.length < 2) {
    setStatus("接続したい点をShiftクリックで2点以上選択してください。");
    return;
  }
  pushHistory();
  selectedPoints.slice(0, -1).forEach((point, index) => {
    addEdge(point.id, selectedPoints[index + 1].id);
  });
  updateAll();
}

function closeSelectedShape() {
  const selectedPoints = state.points.filter((point) => state.selected.has(point.id));
  const currentPathPoints = state.currentPathIds
    .map((id) => state.points.find((point) => point.id === id))
    .filter(Boolean);
  const shapePoints = selectedPoints.length >= 3 ? selectedPoints : currentPathPoints;
  if (shapePoints.length < 3) {
    setStatus(state.language === "en" ? "Close needs at least 3 points." : "閉じるには3点以上の点が必要です。");
    return;
  }
  closeShapePoints(shapePoints);
}

function closeCurrentPath() {
  const shapePoints = state.currentPathIds
    .map((id) => state.points.find((point) => point.id === id))
    .filter(Boolean);
  if (shapePoints.length < 3) {
    setStatus(state.language === "en" ? "Close needs at least 3 points." : "閉じるには3点以上の点が必要です。");
    return;
  }
  closeShapePoints(shapePoints);
}

function closeShapePoints(shapePoints) {
  pushHistory();
  shapePoints.slice(0, -1).forEach((point, index) => {
    addEdge(point.id, shapePoints[index + 1].id);
  });
  addEdge(shapePoints[shapePoints.length - 1].id, shapePoints[0].id);
  const faceIds = shapePoints.map((point) => point.id);
  state.selectedFaceIndex = addFace(faceIds);
  state.currentPathLast = null;
  state.currentPathIds = [];
  state.selected = new Set(faceIds);
  clearSelectedEdges();
  state.lastPointClick = null;
  setStatus(state.language === "en"
    ? "Closed shape. Next point starts a new shape."
    : "形を閉じました。次の点から新しい図を始めます。");
  updateAll();
}

function createPatternCircle(center, radius) {
  if (!Number.isFinite(center?.x) || !Number.isFinite(center?.y) || !Number.isFinite(radius) || radius <= 0) {
    return false;
  }
  const controlRatio = 0.5522847498307936;
  const pointSpecs = [
    { x: center.x, y: center.y - radius },
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y + radius },
    { x: center.x - radius, y: center.y },
  ];
  const circlePoints = pointSpecs.map((spec) => ({
    id: crypto.randomUUID(),
    name: nextPointName(),
    x: spec.x,
    y: spec.y,
  }));
  const [top, right, bottom, left] = circlePoints;
  const k = radius * controlRatio;
  const circleEdges = [
    [top.id, right.id, {
      c1: { x: center.x + k, y: center.y - radius },
      c2: { x: center.x + radius, y: center.y - k },
    }],
    [right.id, bottom.id, {
      c1: { x: center.x + radius, y: center.y + k },
      c2: { x: center.x + k, y: center.y + radius },
    }],
    [bottom.id, left.id, {
      c1: { x: center.x - k, y: center.y + radius },
      c2: { x: center.x - radius, y: center.y + k },
    }],
    [left.id, top.id, {
      c1: { x: center.x - radius, y: center.y - k },
      c2: { x: center.x - k, y: center.y - radius },
    }],
  ];

  state.points.push(...circlePoints);
  state.edges.push(...circleEdges);
  const faceIds = circlePoints.map((point) => point.id);
  state.selectedFaceIndex = addFace(faceIds);
  state.selected = new Set(faceIds);
  clearSelectedEdges();
  state.currentPathLast = null;
  state.currentPathIds = [];
  state.lastPointClick = null;
  return true;
}

function addEdge(fromId, toId) {
  if (fromId === toId) return;
  const exists = state.edges.some(([a, b]) => (a === fromId && b === toId) || (a === toId && b === fromId));
  if (!exists) state.edges.push([fromId, toId]);
}

function addFace(pointIds) {
  const signature = pointIds.join("|");
  const reverseSignature = [...pointIds].reverse().join("|");
  const existingIndex = state.faces.findIndex((face) => {
    const faceSignature = face.join("|");
    return faceSignature === signature || faceSignature === reverseSignature;
  });
  if (existingIndex !== -1) return existingIndex;
  state.faces.push(pointIds);
  return state.faces.length - 1;
}

function selectedStraightScalePair() {
  const indices = selectedEdgeIndexList();
  if (indices.length === 0) return { pair: null, reason: "none" };
  if (indices.length > 1) return { pair: null, reason: "multiple" };

  const edge = state.edges[indices[0]];
  if (!edge) return { pair: null, reason: "none" };
  if (edgeCubicControls(edge)) return { pair: null, reason: "curve" };

  const from = findPointById(edge[0]);
  const to = findPointById(edge[1]);
  if (!from || !to) return { pair: null, reason: "none" };
  return { pair: [from, to], reason: null };
}

function applyCalibrationScale() {
  const length = Number(els.knownLength.value);
  if (!Number.isFinite(length) || length <= 0) {
    setStatus("2点間の実寸に、0より大きい数字を入力してください。例: 38cmなら38");
    return;
  }

  let pair = state.calibrationClicks.length >= 2 ? state.calibrationClicks.slice(0, 2) : null;
  let sourceLabel = state.language === "en" ? "2 clicked points" : "2点間";
  if (!pair) {
    const selected = selectedStraightScalePair();
    pair = selected.pair;
    sourceLabel = state.language === "en" ? "selected line" : "選択線";

    if (!pair) {
      if (selected.reason === "multiple") {
        setStatus(state.language === "en"
          ? "Select exactly one straight line, or click 2 scale points."
          : "スケール設定に使う直線は1本だけ選択してください。2点クリックでも設定できます。");
      } else if (selected.reason === "curve") {
        setStatus(state.language === "en"
          ? "Curves cannot be used for scale yet. Select a straight line or click 2 points."
          : "カーブ線はまだスケール設定に使えません。直線を1本選ぶか、2点クリックしてください。");
      } else {
        setStatus(state.language === "en"
          ? "Click 2 scale points or select one straight line first."
          : "スケール設定は、2点クリックするか、長さが分かる直線を1本選択してください。");
      }
      return;
    }
  }

  const [a, b] = pair;
  const pixelDistance = Math.hypot(b.x - a.x, b.y - a.y);
  if (pixelDistance <= 0) {
    setStatus("2点の距離が近すぎます。もう一度、離れた2点をクリックしてください。");
    return;
  }

  pushHistory();
  const lengthCm = els.unit.value === "mm" ? length / 10 : length;
  state.cmPerPixel = lengthCm / pixelDistance;
  setStatus(state.language === "en"
    ? `Scale set from ${sourceLabel}: ${length}${els.unit.value}`
    : `スケールを設定しました: ${sourceLabel} = ${length}${els.unit.value}`);
  updateAll();
}

function updateScaleReadout() {
  if (!state.cmPerPixel) {
    if (state.calibrationClicks.length === 2) {
      els.scaleStatus.textContent = t("scale.twoPoints");
      els.scaleValue.textContent = `${Number(els.knownLength.value) || "--"} ${els.unit.value}`;
      return;
    }
    els.scaleStatus.textContent = state.calibrationClicks.length === 1 ? t("scale.onePoint") : t("scale.unset");
    els.scaleValue.textContent = state.calibrationClicks.length === 1 ? t("scale.needOneMore") : "--";
    return;
  }
  const unit = els.unit.value;
  const perPixel = unit === "mm" ? state.cmPerPixel * 10 : state.cmPerPixel;
  els.scaleStatus.textContent = t("scale.perPixel");
  els.scaleValue.textContent = `${roundCoord(perPixel)} ${unit}`;
}

function exportObject() {
  const unit = els.unit.value;
  const points = state.points.map((point) => {
    const coords = pointToPattern(point);
    return {
      id: point.id,
      name: point.name,
      x: coords.x,
      y: coords.y,
      image_x_px: roundCoord(point.x),
      image_y_px: roundCoord(point.y),
    };
  });
  return {
    app: "Quack Trace",
    image: state.imageName,
    unit,
    underlay: {
      offset_image_px: {
        x: roundCoord(state.sourceOffset.x),
        y: roundCoord(state.sourceOffset.y),
      },
      scale: roundCoord(state.sourceScale || 1),
    },
    scale: {
      cm_per_pixel: state.cmPerPixel ? roundCoord(state.cmPerPixel) : null,
      origin_image_px: state.origin ? { x: roundCoord(state.origin.x), y: roundCoord(state.origin.y) } : null,
      y_axis: state.yUp ? "up" : "down",
    },
    points,
    edges: state.edges,
    faces: state.faces,
  };
}

function updateExports() {
  els.exportText.value = JSON.stringify(exportObject(), null, 2);
}

function exportBlockReason() {
  if (!state.cmPerPixel) return t("export.noScale");
  if (state.faces.length === 0) return t("export.noFace");
  return "";
}

function printBlockReason() {
  if (!state.cmPerPixel) return t("print.needScale");
  if (state.edges.length === 0) return t("print.needLine");
  return "";
}

function updateExportReadiness() {
  const reason = exportBlockReason();
  const exportReady = !reason;
  [downloadDxfButton, downloadMdCloPyButton, downloadBlenderPyButton].forEach((button) => {
    button.disabled = !exportReady;
    button.title = exportReady ? "" : reason;
  });
  const printReason = printBlockReason();
  printPdfButton.disabled = Boolean(printReason);
  printPdfButton.title = printReason || t("export.printPdfTitle");
  exportStatus.className = `export-status ${exportReady ? "ready" : "waiting"}`;
  exportStatus.innerHTML = exportReady
    ? `<strong>${escapeHtml(t("export.ready"))}</strong>`
    : `<strong>${escapeHtml(reason)}</strong>`;
}

function csvText() {
  const rows = [["name", "x", "y", "unit", "image_x_px", "image_y_px"]];
  state.points.forEach((point) => {
    const coords = pointToPattern(point);
    rows.push([point.name, coords.x, coords.y, els.unit.value, roundCoord(point.x), roundCoord(point.y)]);
  });
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function importedControlPoint(point) {
  if (!point || typeof point !== "object") return null;
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  return x === null || y === null ? null : { x, y };
}

function importedEdgeControl(control) {
  if (!control || typeof control !== "object") return null;
  const c1 = importedControlPoint(control.c1);
  const c2 = importedControlPoint(control.c2);
  if (c1 && c2) return { c1, c2 };
  const x = finiteNumber(control.x);
  const y = finiteNumber(control.y);
  return x === null || y === null ? null : { x, y };
}

function createJsonImportWorkspace(points, origin) {
  const xs = points.map((point) => point.x).concat(origin ? [origin.x] : []);
  const ys = points.map((point) => point.y).concat(origin ? [origin.y] : []);
  const width = Math.max(1000, Math.ceil(Math.max(...xs, 800) + 160));
  const height = Math.max(720, Math.ceil(Math.max(...ys, 560) + 160));
  const grid = document.createElement("canvas");
  grid.width = width;
  grid.height = height;
  const gctx = grid.getContext("2d");
  gctx.fillStyle = "#ffffff";
  gctx.fillRect(0, 0, width, height);
  gctx.strokeStyle = "#dce2e8";
  gctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 50) {
    gctx.beginPath();
    gctx.moveTo(x, 0);
    gctx.lineTo(x, height);
    gctx.stroke();
  }
  for (let y = 0; y <= height; y += 50) {
    gctx.beginPath();
    gctx.moveTo(0, y);
    gctx.lineTo(width, y);
    gctx.stroke();
  }
  return grid;
}

function nextImportedPointName(points) {
  const maxNumber = points.reduce((max, point) => {
    const match = String(point.name || "").match(/^P(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `P${maxNumber + 1 || points.length + 1}`;
}

function importQuackTraceJson(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.points)) {
    throw new Error("Quack Trace JSONではありません。");
  }

  const unit = data.unit === "mm" ? "mm" : "cm";
  const cmPerPixel = finiteNumber(data.scale?.cm_per_pixel);
  const importedOrigin = data.scale?.origin_image_px;
  const originX = finiteNumber(importedOrigin?.x);
  const originY = finiteNumber(importedOrigin?.y);
  const origin = originX === null || originY === null ? null : { x: originX, y: originY };
  const yUp = data.scale?.y_axis === "up";
  const importedUnderlayOffset = data.underlay?.offset_image_px;
  const underlayOffsetX = finiteNumber(importedUnderlayOffset?.x);
  const underlayOffsetY = finiteNumber(importedUnderlayOffset?.y);
  const underlayScale = Math.min(MAX_SOURCE_SCALE, Math.max(MIN_SOURCE_SCALE, finiteNumber(data.underlay?.scale) || 1));

  const importedPoints = data.points.map((source, index) => {
    const imageX = finiteNumber(source.image_x_px);
    const imageY = finiteNumber(source.image_y_px);
    const fallback = origin ? patternCoordsToImagePoint(source, unit, cmPerPixel, origin, yUp) : null;
    const x = imageX ?? fallback?.x;
    const y = imageY ?? fallback?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      id: source.id || crypto.randomUUID(),
      name: source.name || `P${index + 1}`,
      x,
      y,
    };
  }).filter(Boolean);

  if (importedPoints.length === 0) {
    throw new Error("読み込める点がありません。");
  }

  const validIds = new Set(importedPoints.map((point) => point.id));
  const importedEdges = (Array.isArray(data.edges) ? data.edges : []).map((edge) => {
    if (!Array.isArray(edge) || edge.length < 2) return null;
    const fromId = edge[0];
    const toId = edge[1];
    if (!validIds.has(fromId) || !validIds.has(toId)) return null;
    const control = importedEdgeControl(edge[2]);
    return control ? [fromId, toId, control] : [fromId, toId];
  }).filter(Boolean);
  const importedFaces = (Array.isArray(data.faces) ? data.faces : []).map((face) => (
    Array.isArray(face) ? face.filter((pointId) => validIds.has(pointId)) : []
  )).filter((face) => face.length >= 3);

  state.imageName = typeof data.image === "string" && data.image.trim() ? data.image.trim() : "imported-json";
  if (!state.image) state.image = createJsonImportWorkspace(importedPoints, origin);
  state.points = importedPoints;
  state.edges = importedEdges;
  state.faces = importedFaces;
  ensureFaceBoundaryEdges();
  state.currentPathLast = null;
  state.currentPathIds = [];
  state.selected.clear();
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  state.calibrationClicks = [];
  state.cmPerPixel = cmPerPixel;
  state.origin = origin;
  state.yUp = yUp;
  state.sourceOffset = {
    x: underlayOffsetX ?? 0,
    y: underlayOffsetY ?? 0,
  };
  state.sourceScale = underlayScale;
  state.sketchStrokes = [];
  state.sketchCircles = [];
  state.dxfGuidePaths = [];
  state.fitViewBefore = null;
  state.lastPointClick = null;
  els.unit.value = unit;
  els.knownLengthUnit.textContent = unit;
  arrowMoveUnit.textContent = unit;
  els.yUp.checked = yUp;
  els.pointName.value = nextImportedPointName(importedPoints);
  clearUndoHistory();
  setMode("select");
  updateAll();
  fitImage();
  setStatus(state.language === "en"
    ? `Imported JSON. Restored ${importedPoints.length} points / ${importedFaces.length} faces.`
    : `JSONを読み込みました。${importedPoints.length}点 / ${importedFaces.length}面を復元しました。`);
}

function parseDxfPairs(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
  const pairs = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    const code = Number(String(lines[index]).trim());
    if (!Number.isFinite(code)) continue;
    pairs.push({ code, value: String(lines[index + 1]).trim() });
  }
  return pairs;
}

function collectDxfEntityPairs(pairs, startIndex) {
  const entityPairs = [];
  let index = startIndex + 1;
  while (index < pairs.length && pairs[index].code !== 0) {
    entityPairs.push(pairs[index]);
    index += 1;
  }
  return { pairs: entityPairs, nextIndex: index - 1 };
}

function parseDxfPolylineEntity(pairs, startIndex) {
  const header = [];
  const vertices = [];
  let currentVertex = null;
  let index = startIndex + 1;

  for (; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code === 0) {
      const marker = pair.value.toUpperCase();
      if (marker === "VERTEX") {
        if (currentVertex) vertices.push(currentVertex);
        currentVertex = [];
        continue;
      }
      if (marker === "SEQEND") {
        if (currentVertex) vertices.push(currentVertex);
        break;
      }
      if (currentVertex) vertices.push(currentVertex);
      index -= 1;
      break;
    }
    if (currentVertex) currentVertex.push(pair);
    else header.push(pair);
  }

  return { entity: { type: "POLYLINE", pairs: header, vertices }, nextIndex: index };
}

function parseDxfEntityAt(pairs, startIndex) {
  const marker = pairs[startIndex]?.value?.toUpperCase();
  if (marker === "POLYLINE") return parseDxfPolylineEntity(pairs, startIndex);
  if (["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "SPLINE", "POINT", "INSERT"].includes(marker)) {
    const collected = collectDxfEntityPairs(pairs, startIndex);
    return { entity: { type: marker, pairs: collected.pairs }, nextIndex: collected.nextIndex };
  }
  return null;
}

function dxfNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dxfFirstNumber(pairs, code, fallback = null) {
  const pair = pairs.find((candidate) => candidate.code === code);
  return pair ? dxfNumber(pair.value) : fallback;
}

function dxfFirstText(pairs, code, fallback = "") {
  const pair = pairs.find((candidate) => candidate.code === code);
  return pair ? String(pair.value) : fallback;
}

function dxfFlag(pairs, code) {
  return dxfFirstNumber(pairs, code, 0) || 0;
}

function parseDxfDocument(text) {
  const pairs = parseDxfPairs(text);
  const entities = [];
  const blocks = new Map();
  let section = "";
  let currentBlock = null;

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (pair.code !== 0) continue;
    const marker = pair.value.toUpperCase();

    if (marker === "SECTION") {
      section = pairs[index + 1]?.code === 2 ? pairs[index + 1].value.toUpperCase() : "";
      continue;
    }
    if (marker === "ENDSEC") {
      section = "";
      currentBlock = null;
      continue;
    }

    if (section === "BLOCKS") {
      if (marker === "BLOCK") {
        const collected = collectDxfEntityPairs(pairs, index);
        const blockPairs = collected.pairs;
        currentBlock = {
          name: dxfFirstText(blockPairs, 2, ""),
          base: {
            x: dxfFirstNumber(blockPairs, 10, 0) || 0,
            y: dxfFirstNumber(blockPairs, 20, 0) || 0,
          },
          entities: [],
        };
        index = collected.nextIndex;
        continue;
      }
      if (marker === "ENDBLK") {
        if (currentBlock?.name) blocks.set(currentBlock.name, currentBlock);
        currentBlock = null;
        continue;
      }
      if (currentBlock) {
        const parsed = parseDxfEntityAt(pairs, index);
        if (parsed) {
          currentBlock.entities.push(parsed.entity);
          index = parsed.nextIndex;
        }
      }
      continue;
    }

    if (section === "ENTITIES") {
      const parsed = parseDxfEntityAt(pairs, index);
      if (parsed) {
        entities.push(parsed.entity);
        index = parsed.nextIndex;
      }
    }
  }

  return { blocks, entities };
}

function dxfInsertTransform(insertPairs, blockBase = { x: 0, y: 0 }) {
  const insertX = dxfFirstNumber(insertPairs, 10, 0) || 0;
  const insertY = dxfFirstNumber(insertPairs, 20, 0) || 0;
  const scaleX = dxfFirstNumber(insertPairs, 41, 1) || 1;
  const scaleY = dxfFirstNumber(insertPairs, 42, scaleX) || scaleX;
  const rotation = ((dxfFirstNumber(insertPairs, 50, 0) || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { insertX, insertY, scaleX, scaleY, cos, sin, blockBase };
}

function transformDxfPoint(point, transform) {
  if (!transform) return point;
  const x = (point.x - transform.blockBase.x) * transform.scaleX;
  const y = (point.y - transform.blockBase.y) * transform.scaleY;
  return {
    x: transform.insertX + x * transform.cos - y * transform.sin,
    y: transform.insertY + x * transform.sin + y * transform.cos,
    bulge: point.bulge || 0,
    keyPoint: Boolean(point.keyPoint),
  };
}

function expandDxfEntities(document) {
  const expanded = [];
  document.entities.forEach((entity) => {
    if (entity.type !== "INSERT") {
      expanded.push(entity);
      return;
    }
    const blockName = dxfFirstText(entity.pairs || [], 2, "");
    const block = document.blocks.get(blockName);
    if (!block) return;
    const transform = dxfInsertTransform(entity.pairs || [], block.base);
    block.entities.forEach((blockEntity) => {
      expanded.push({ ...blockEntity, transform, blockName });
    });
  });

  if (expanded.length > 0) return expanded;
  document.blocks.forEach((block) => {
    block.entities.forEach((entity) => expanded.push({ ...entity, blockName: block.name }));
  });
  return expanded;
}

function dxfPointSequence(pairs, xCode = 10, yCode = 20) {
  const points = [];
  let current = null;
  pairs.forEach((pair) => {
    if (pair.code === xCode) {
      if (current && Number.isFinite(current.x) && Number.isFinite(current.y)) points.push(current);
      current = { x: dxfNumber(pair.value), y: null, bulge: 0 };
    } else if (pair.code === yCode && current) {
      current.y = dxfNumber(pair.value);
    } else if (pair.code === 42 && current) {
      current.bulge = dxfNumber(pair.value) || 0;
    }
  });
  if (current && Number.isFinite(current.x) && Number.isFinite(current.y)) points.push(current);
  return points;
}

function sameDxfPoint(a, b, tolerance = 0.0001) {
  return Boolean(a && b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance);
}

function sampleDxfBulgeSegment(from, to, bulge) {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 0.000001) return [to];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [];

  const theta = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const ux = dx / chord;
  const uy = dy / chord;
  const normal = { x: -uy, y: ux };
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const centerDistance = radius * Math.cos(theta / 2) * Math.sign(bulge);
  const center = {
    x: midpoint.x + normal.x * centerDistance,
    y: midpoint.y + normal.y * centerDistance,
  };
  const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
  let endAngle = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = endAngle - startAngle;
  if (bulge > 0 && delta <= 0) delta += Math.PI * 2;
  if (bulge < 0 && delta >= 0) delta -= Math.PI * 2;
  endAngle = startAngle + delta;

  const steps = Math.max(4, Math.ceil(Math.abs(delta) / (Math.PI / 18)));
  const samples = [];
  for (let step = 1; step <= steps; step += 1) {
    const angle = startAngle + (endAngle - startAngle) * (step / steps);
    samples.push({
      x: center.x + Math.cos(angle) * Math.abs(radius),
      y: center.y + Math.sin(angle) * Math.abs(radius),
    });
  }
  return samples;
}

function dxfPolylinePath(vertices, closed) {
  if (vertices.length < 2) return [];
  const points = [{ x: vertices[0].x, y: vertices[0].y }];
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = vertices[index];
    const to = vertices[(index + 1) % vertices.length];
    const samples = sampleDxfBulgeSegment(from, to, from.bulge || 0);
    points.push(...samples);
  }
  if (closed && sameDxfPoint(points[0], points[points.length - 1])) points.pop();
  return points;
}

function sampleDxfArc(center, radius, startDegrees, endDegrees) {
  if (!center || !Number.isFinite(radius) || radius <= 0) return [];
  let start = (startDegrees * Math.PI) / 180;
  let end = (endDegrees * Math.PI) / 180;
  while (end < start) end += Math.PI * 2;
  const steps = Math.max(4, Math.ceil((end - start) / (Math.PI / 18)));
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = start + (end - start) * (step / steps);
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      keyPoint: step === 0 || step === steps,
    });
  }
  return points;
}

function dxfEntityToPath(entity) {
  const pairs = entity.pairs || [];
  const transformPath = (path) => ({
    ...path,
    points: path.points.map((point) => transformDxfPoint(point, entity.transform)),
  });

  if (entity.type === "LINE") {
    const x1 = dxfFirstNumber(pairs, 10);
    const y1 = dxfFirstNumber(pairs, 20);
    const x2 = dxfFirstNumber(pairs, 11);
    const y2 = dxfFirstNumber(pairs, 21);
    if ([x1, y1, x2, y2].some((value) => value === null)) return null;
    return transformPath({ points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], closed: false });
  }

  if (entity.type === "LWPOLYLINE") {
    const vertices = dxfPointSequence(pairs);
    const closed = Boolean(dxfFlag(pairs, 70) & 1) || sameDxfPoint(vertices[0], vertices[vertices.length - 1]);
    return transformPath({ points: dxfPolylinePath(vertices, closed), closed });
  }

  if (entity.type === "POLYLINE") {
    const vertices = (entity.vertices || []).map((vertexPairs) => dxfPointSequence(vertexPairs)[0]).filter(Boolean);
    const closed = Boolean(dxfFlag(pairs, 70) & 1) || sameDxfPoint(vertices[0], vertices[vertices.length - 1]);
    return transformPath({ points: dxfPolylinePath(vertices, closed), closed });
  }

  if (entity.type === "CIRCLE" || entity.type === "ARC") {
    const center = { x: dxfFirstNumber(pairs, 10), y: dxfFirstNumber(pairs, 20) };
    const radius = dxfFirstNumber(pairs, 40);
    if (center.x === null || center.y === null || radius === null) return null;
    if (entity.type === "CIRCLE") {
      return transformPath({ points: sampleDxfArc(center, radius, 0, 360).slice(0, -1), closed: true });
    }
    const start = dxfFirstNumber(pairs, 50) ?? 0;
    const end = dxfFirstNumber(pairs, 51) ?? 0;
    return transformPath({ points: sampleDxfArc(center, radius, start, end), closed: false });
  }

  if (entity.type === "SPLINE") {
    const fitPoints = dxfPointSequence(pairs, 11, 21);
    const controlPoints = dxfPointSequence(pairs, 10, 20);
    const points = fitPoints.length >= 2 ? fitPoints : controlPoints;
    return transformPath({ points, closed: Boolean(dxfFlag(pairs, 70) & 1) });
  }

  return null;
}

function dxfEntityToMarker(entity) {
  if (entity.type !== "POINT") return null;
  const pairs = entity.pairs || [];
  const x = dxfFirstNumber(pairs, 10);
  const y = dxfFirstNumber(pairs, 20);
  if (x === null || y === null) return null;
  const point = transformDxfPoint({ x, y, keyPoint: true }, entity.transform);
  return {
    ...point,
    layer: dxfFirstText(pairs, 8, ""),
  };
}

function dxfDistanceToSegment(point, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq));
  const x = from.x + dx * t;
  const y = from.y + dy * t;
  return Math.hypot(point.x - x, point.y - y);
}

function dxfNearestPathPosition(point, points, closed) {
  const edgeCount = closed ? points.length : points.length - 1;
  let best = { distance: Infinity, order: 0 };
  for (let index = 0; index < edgeCount; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq));
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < best.distance) best = { distance, order: index + t };
  }
  return best;
}

function mergeDxfKeyPoints(points, keyPoints, sourcePoints, closed) {
  if (!Array.isArray(keyPoints) || keyPoints.length === 0) return points;
  const merged = [];
  const seen = new Set();
  const addPoint = (point) => {
    const key = `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
    if (seen.has(key)) return;
    const position = dxfNearestPathPosition(point, sourcePoints, closed);
    seen.add(key);
    merged.push({ ...point, keyPoint: true, _dxfOrder: position.order });
  };

  points.forEach(addPoint);
  keyPoints
    .filter((point) => dxfNearestPathPosition(point, points, closed).distance > 2.5)
    .forEach(addPoint);
  merged.sort((a, b) => a._dxfOrder - b._dxfOrder);
  return merged.map(({ _dxfOrder, ...point }) => point);
}

function simplifyDxfOpenPoints(points, tolerance = 2.2) {
  if (points.length <= 2) return [...points];
  let maxDistance = -1;
  let splitIndex = -1;
  const first = points[0];
  const last = points[points.length - 1];
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = dxfDistanceToSegment(points[index], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }
  if (maxDistance <= tolerance || splitIndex === -1) return [first, last];
  const left = simplifyDxfOpenPoints(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyDxfOpenPoints(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function dxfAngleAt(previous, current, next) {
  const ax = previous.x - current.x;
  const ay = previous.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (aLength === 0 || bLength === 0) return Math.PI;
  const dot = (ax * bx + ay * by) / (aLength * bLength);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function dxfClosedCornerIndexes(points) {
  const corners = [];
  const cornerAngle = (150 * Math.PI) / 180;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (dxfAngleAt(previous, current, next) < cornerAngle) corners.push(index);
  }
  return corners;
}

function dxfClosedSegment(points, startIndex, endIndex) {
  const segment = [points[startIndex]];
  let index = startIndex;
  while (index !== endIndex) {
    index = (index + 1) % points.length;
    segment.push(points[index]);
  }
  return segment;
}

function simplifyDxfClosedPoints(points, tolerance = 2.2) {
  const uniquePoints = sameDxfPoint(points[0], points[points.length - 1]) ? points.slice(0, -1) : [...points];
  if (uniquePoints.length <= 4) return uniquePoints;
  const corners = dxfClosedCornerIndexes(uniquePoints);

  if (corners.length >= 2) {
    const simplified = [];
    corners.forEach((cornerIndex, index) => {
      const nextCornerIndex = corners[(index + 1) % corners.length];
      const segment = dxfClosedSegment(uniquePoints, cornerIndex, nextCornerIndex);
      const segmentSimplified = simplifyDxfOpenPoints(segment, tolerance);
      if (index === 0) simplified.push(...segmentSimplified);
      else simplified.push(...segmentSimplified.slice(1));
    });
    if (sameDxfPoint(simplified[0], simplified[simplified.length - 1])) simplified.pop();
    return simplified.length >= 3 ? simplified : uniquePoints;
  }

  const halfIndex = Math.floor(uniquePoints.length / 2);
  const firstHalf = simplifyDxfOpenPoints(uniquePoints.slice(0, halfIndex + 1), tolerance);
  const secondHalf = simplifyDxfOpenPoints([...uniquePoints.slice(halfIndex), uniquePoints[0]], tolerance);
  const combined = [...firstHalf, ...secondHalf.slice(1, -1)];
  return combined.length >= 3 ? combined : uniquePoints;
}

function simplifyDxfPathPoints(points, closed) {
  if (closed) return simplifyDxfClosedPoints(points);
  return simplifyDxfOpenPoints(points);
}

function simplifyDxfClosedByDiameter(points, tolerance = 36) {
  const uniquePoints = sameDxfPoint(points[0], points[points.length - 1]) ? points.slice(0, -1) : [...points];
  if (uniquePoints.length <= 4) return uniquePoints;
  let firstIndex = 0;
  let secondIndex = Math.floor(uniquePoints.length / 2);
  let maxDistance = -1;
  for (let a = 0; a < uniquePoints.length; a += 1) {
    for (let b = a + 1; b < uniquePoints.length; b += 1) {
      const distance = Math.hypot(uniquePoints[a].x - uniquePoints[b].x, uniquePoints[a].y - uniquePoints[b].y);
      if (distance > maxDistance) {
        maxDistance = distance;
        firstIndex = a;
        secondIndex = b;
      }
    }
  }
  const firstSegment = dxfClosedSegment(uniquePoints, firstIndex, secondIndex);
  const secondSegment = dxfClosedSegment(uniquePoints, secondIndex, firstIndex);
  const simplified = [
    ...simplifyDxfOpenPoints(firstSegment, tolerance),
    ...simplifyDxfOpenPoints(secondSegment, tolerance).slice(1, -1),
  ];
  return simplified.length >= 3 ? simplified : uniquePoints;
}

function dxfNearestUniquePoint(target, points, used) {
  let best = null;
  let bestDistance = Infinity;
  points.forEach((point) => {
    const key = `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
    if (used.has(key)) return;
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  });
  if (!best) return null;
  used.add(`${best.x.toFixed(3)},${best.y.toFixed(3)}`);
  return best;
}

function simplifyDxfThinClosedPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const thin = Math.min(width, height);
  const long = Math.max(width, height);
  if (thin > 45 || long / Math.max(1, thin) < 3) return null;

  const used = new Set();
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
    .map((corner) => dxfNearestUniquePoint(corner, points, used))
    .filter(Boolean);
  return corners.length >= 3 ? corners : null;
}

function simplifyDxfStraightenedPoints(points, closed) {
  const uniquePoints = closed && sameDxfPoint(points[0], points[points.length - 1]) ? points.slice(0, -1) : [...points];
  if (uniquePoints.length <= 4) return uniquePoints;
  const keyPoints = uniquePoints.filter((point) => point.keyPoint);
  const sharpCornerAngle = (115 * Math.PI) / 180;

  if (closed && keyPoints.length >= 3 && keyPoints.length < uniquePoints.length * 0.6) return keyPoints;
  if (!closed && keyPoints.length >= 2 && keyPoints.length < uniquePoints.length * 0.6) return keyPoints;

  if (closed) {
    const thinShape = simplifyDxfThinClosedPoints(uniquePoints);
    if (thinShape) return thinShape;
    const corners = [];
    for (let index = 0; index < uniquePoints.length; index += 1) {
      const previous = uniquePoints[(index - 1 + uniquePoints.length) % uniquePoints.length];
      const current = uniquePoints[index];
      const next = uniquePoints[(index + 1) % uniquePoints.length];
      if (dxfAngleAt(previous, current, next) < sharpCornerAngle) corners.push(index);
    }
    if (corners.length >= 3 && corners.length < uniquePoints.length * 0.25) return corners.map((index) => uniquePoints[index]);
    return simplifyDxfClosedByDiameter(uniquePoints, 36);
  }

  const keep = [uniquePoints[0]];
  for (let index = 1; index < uniquePoints.length - 1; index += 1) {
    if (dxfAngleAt(uniquePoints[index - 1], uniquePoints[index], uniquePoints[index + 1]) < sharpCornerAngle) {
      keep.push(uniquePoints[index]);
    }
  }
  keep.push(uniquePoints[uniquePoints.length - 1]);
  if (keep.length > 2 && keep.length < uniquePoints.length * 0.25) return keep;
  return simplifyDxfOpenPoints(uniquePoints, 36);
}

function dxfCurveControlsForPoints(points, closed) {
  const edgeCount = closed ? points.length : points.length - 1;
  if (edgeCount <= 0) return [];
  const cornerAngle = (150 * Math.PI) / 180;
  const tangents = points.map((point, index) => {
    if (!closed && (index === 0 || index === points.length - 1)) return { x: 0, y: 0 };
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    if (dxfAngleAt(previous, point, next) < cornerAngle) return { x: 0, y: 0 };
    return {
      x: (next.x - previous.x) / 6,
      y: (next.y - previous.y) / 6,
    };
  });
  const controls = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const p1 = points[index];
    const p2 = points[(index + 1) % points.length];
    const t1 = tangents[index];
    const t2 = tangents[(index + 1) % points.length];
    controls.push({
      c1: {
        x: p1.x + t1.x,
        y: p1.y + t1.y,
      },
      c2: {
        x: p2.x - t2.x,
        y: p2.y - t2.y,
      },
    });
  }
  return controls;
}

function buildDxfImportPath(path, curveFit, straightenCurves = false) {
  let pathPoints = [...path.points];
  if (path.closed && sameDxfPoint(pathPoints[0], pathPoints[pathPoints.length - 1])) pathPoints = pathPoints.slice(0, -1);
  if ((!curveFit && !straightenCurves) || pathPoints.length <= 4) return { points: pathPoints, controls: [], closed: path.closed };
  let simplifiedPoints = straightenCurves
    ? simplifyDxfStraightenedPoints(pathPoints, path.closed)
    : simplifyDxfPathPoints(pathPoints, path.closed);
  simplifiedPoints = mergeDxfKeyPoints(simplifiedPoints, path.keyPoints || [], pathPoints, path.closed);
  if (straightenCurves) return { points: simplifiedPoints, controls: [], closed: path.closed };
  const controls = dxfCurveControlsForPoints(simplifiedPoints, path.closed);
  return { points: simplifiedPoints, controls, closed: path.closed };
}

function createTransparentWorkspace(width, height) {
  const grid = document.createElement("canvas");
  grid.width = Math.max(320, Math.ceil(width));
  grid.height = Math.max(240, Math.ceil(height));
  return grid;
}

function importDxfText(text, fileName = "imported-dxf") {
  const document = parseDxfDocument(text);
  const expandedEntities = expandDxfEntities(document);
  const keepDxfMarkers = Boolean(dxfKeepMarkersToggle?.checked);
  const allPaths = expandedEntities
    .map(dxfEntityToPath)
    .filter((path) => path && path.points.length >= 2);
  const dxfMarkerPoints = keepDxfMarkers
    ? expandedEntities
      .map(dxfEntityToMarker)
      .filter((point) => point && point.layer !== "3")
    : [];
  const closedPaths = allPaths.filter((path) => path.closed && path.points.length >= 3);
  const openPaths = allPaths.filter((path) => !path.closed);
  const includeInternalLines = Boolean(dxfInternalLinesToggle?.checked);
  const paths = closedPaths.length > 0
    ? (includeInternalLines ? [...closedPaths, ...openPaths] : closedPaths)
    : allPaths;
  if (paths.length === 0) {
    throw new Error("読み込めるDXF図形がありません。BLOCKS / INSERT / POLYLINE を確認してください。");
  }

  const allPoints = paths.flatMap((path) => path.points);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const margin = 80;
  const origin = { x: margin - minX, y: margin + maxY };
  const cmPerPixel = 0.1;
  const pointMap = new Map();
  const importedPoints = [];
  const importedEdges = [];
  const importedFaces = [];
  const dxfGuidePaths = [];
  const curveFit = Boolean(dxfCurveFitToggle?.checked);
  const straightenCurves = Boolean(dxfStraightenCurvesToggle?.checked);
  const simplifyCurves = curveFit || straightenCurves;
  const showOriginalGuide = simplifyCurves && Boolean(dxfOriginalGuideToggle?.checked);
  let sourcePointCount = 0;

  function imagePointFromDxf(point) {
    return { x: origin.x + point.x, y: origin.y - point.y, keyPoint: Boolean(point.keyPoint) };
  }

  const imageMarkerPoints = dxfMarkerPoints.map(imagePointFromDxf);

  function addImportedImagePoint(imagePoint) {
    const key = `${imagePoint.x.toFixed(4)},${imagePoint.y.toFixed(4)}`;
    if (pointMap.has(key)) return pointMap.get(key);
    const point = {
      id: crypto.randomUUID(),
      name: `P${importedPoints.length + 1}`,
      x: imagePoint.x,
      y: imagePoint.y,
    };
    importedPoints.push(point);
    pointMap.set(key, point);
    return point;
  }

  function addImportedPoint(dxfPoint) {
    return addImportedImagePoint(imagePointFromDxf(dxfPoint));
  }

  paths.forEach((path) => {
    let sourcePoints = [...path.points];
    if (path.closed && sameDxfPoint(sourcePoints[0], sourcePoints[sourcePoints.length - 1])) sourcePoints = sourcePoints.slice(0, -1);
    sourcePointCount += sourcePoints.length;

    const imagePoints = sourcePoints.map(imagePointFromDxf);
    const pathKeyPoints = imageMarkerPoints.filter((point) => (
      dxfNearestPathPosition(point, imagePoints, path.closed).distance <= 2.5
    ));
    if (showOriginalGuide && imagePoints.length >= 2) {
      dxfGuidePaths.push(path.closed ? [...imagePoints, imagePoints[0]] : imagePoints);
    }

    const importPath = buildDxfImportPath({ points: imagePoints, keyPoints: pathKeyPoints, closed: path.closed }, curveFit, straightenCurves);
    const ids = importPath.points.map((point) => addImportedImagePoint(point).id);
    const edgeCount = importPath.closed ? ids.length : ids.length - 1;
    for (let index = 0; index < edgeCount; index += 1) {
      const id = ids[index];
      const nextId = ids[(index + 1) % ids.length];
      if (!nextId || id === nextId) continue;
      const control = importPath.controls[index];
      importedEdges.push(control ? [id, nextId, control] : [id, nextId]);
    }
    if (importPath.closed && ids.length >= 3) {
      importedFaces.push(ids);
    }
  });

  state.imageName = fileName.replace(/\.[^.]+$/, "") || "imported-dxf";
  state.image = createTransparentWorkspace((maxX - minX) + margin * 2, (maxY - minY) + margin * 2);
  state.points = importedPoints;
  state.edges = importedEdges;
  state.faces = importedFaces;
  state.currentPathLast = null;
  state.currentPathIds = [];
  state.selected.clear();
  clearSelectedEdges();
  state.selectedFaceIndex = null;
  state.calibrationClicks = [];
  state.cmPerPixel = cmPerPixel;
  state.origin = origin;
  state.yUp = true;
  state.sourceOffset = { x: 0, y: 0 };
  state.sourceScale = 1;
  state.sketchStrokes = [];
  state.sketchCircles = [];
  state.dxfGuidePaths = showOriginalGuide ? dxfGuidePaths : [];
  state.fitViewBefore = null;
  state.lastPointClick = null;
  state.imageOpacity = 0;
  opacityInput.value = "0";
  setShapeOpacity(DEFAULT_SHAPE_OPACITY);
  els.unit.value = "mm";
  els.knownLengthUnit.textContent = "mm";
  arrowMoveUnit.textContent = "mm";
  els.knownLength.value = "100";
  els.pointName.value = nextImportedPointName(importedPoints);
  clearUndoHistory();
  setMode("select");
  updateAll();
  fitImage();
  const curveFitNote = simplifyCurves && sourcePointCount > importedPoints.length
    ? (state.language === "en"
      ? ` ${curveFit ? "Curve fit" : "Line-simplified"} ${sourcePointCount} source points to ${importedPoints.length} edit points.`
      : ` ${curveFit ? "カーブ化" : "直線化"}で元${sourcePointCount}点を編集点${importedPoints.length}点にしました。`)
    : "";
  const markerNote = dxfMarkerPoints.length > 0
    ? (state.language === "en"
      ? ` Kept ${dxfMarkerPoints.length} DXF point markers.`
      : ` DXFポイント${dxfMarkerPoints.length}個を重要点候補にしました。`)
    : "";
  setStatus(state.language === "en"
    ? `Imported DXF beta. ${importedPoints.length} points / ${importedEdges.length} lines / ${importedFaces.length} faces. Closed ${closedPaths.length}, internal ${includeInternalLines ? openPaths.length : 0}.${curveFitNote}${markerNote}`
    : `DXF実験読込: ${importedPoints.length}点 / ${importedEdges.length}線 / ${importedFaces.length}面です。外形 ${closedPaths.length}、内部線 ${includeInternalLines ? openPaths.length : 0}。${curveFitNote}${markerNote}`);
}

function svgText() {
  const unit = els.unit.value;
  const fromMm = (mm) => unit === "cm" ? mm / 10 : mm;
  const margin = fromMm(8);
  const strokeWidth = fromMm(0.4);
  const pointRadius = fromMm(1.6);
  const labelOffset = fromMm(2.4);
  const labelSize = fromMm(3.6);
  const points = state.points.map((point) => ({ ...point, coords: pointToPattern(point) }));
  if (points.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100${unit}" height="100${unit}" viewBox="0 0 100 100"></svg>`;
  }
  const xs = points.map((point) => point.coords.x);
  const ys = points.map((point) => point.coords.y);
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  const maxX = Math.max(...xs) + margin;
  const maxY = Math.max(...ys) + margin;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const pointMap = new Map(points.map((point) => [point.id, point]));
  const edgeLines = state.edges.map((edge) => {
    const [fromId, toId] = edge;
    const from = pointMap.get(fromId);
    const to = pointMap.get(toId);
    if (!from || !to) return "";
    const controls = edgeCubicControls(edge);
    if (controls) {
      const c1 = imagePointToPatternCoords(controls.c1);
      const c2 = imagePointToPatternCoords(controls.c2);
      return `<path d="M ${from.coords.x} ${from.coords.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.coords.x} ${to.coords.y}" />`;
    }
    return `<line x1="${from.coords.x}" y1="${from.coords.y}" x2="${to.coords.x}" y2="${to.coords.y}" />`;
  }).join("\n  ");
  const facePolygons = state.faces.map((face) => {
    const facePoints = face.map((id) => pointMap.get(id)).filter(Boolean);
    if (facePoints.length < 3) return "";
    const first = pointMap.get(face[0]);
    if (!first) return "";
    const commands = [`M ${first.coords.x} ${first.coords.y}`];
    face.slice(1).forEach((pointId, index) => {
      const fromId = face[index];
      const point = pointMap.get(pointId);
      if (!point) return;
      const control = edgeControlForDirection(fromId, pointId);
      if (control) {
        const c1 = imagePointToPatternCoords(control.c1);
        const c2 = imagePointToPatternCoords(control.c2);
        commands.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${point.coords.x} ${point.coords.y}`);
      } else {
        commands.push(`L ${point.coords.x} ${point.coords.y}`);
      }
    });
    const lastId = face[face.length - 1];
    const closeControl = edgeControlForDirection(lastId, face[0]);
    if (closeControl) {
      const c1 = imagePointToPatternCoords(closeControl.c1);
      const c2 = imagePointToPatternCoords(closeControl.c2);
      commands.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${first.coords.x} ${first.coords.y}`);
    }
    commands.push("Z");
    return `<path d="${commands.join(" ")}" class="face" />`;
  }).join("\n  ");
  const includePointLabels = svgLabelsToggle.checked;
  const pointMarks = points.map((point) => {
    const label = includePointLabels
      ? `<text x="${point.coords.x + labelOffset}" y="${point.coords.y - labelOffset}">${escapeXml(point.name)}</text>`
      : "";
    return `<g class="point-mark"><circle cx="${point.coords.x}" cy="${point.coords.y}" r="${pointRadius}" />${label}</g>`;
  }).join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${unit}" height="${height}${unit}" viewBox="${minX} ${minY} ${width} ${height}">
  <style>
    line, path { stroke: #111; stroke-width: ${strokeWidth}; fill: none; }
    .face { fill: #cfeff4; fill-opacity: 0.5; stroke: none; }
    circle { fill: #f2c037; }
    text { font: ${labelSize}px sans-serif; fill: #111; }
  </style>
  ${facePolygons}
  ${edgeLines}
  ${pointMarks}
</svg>`;
}

function dxfPair(lines, code, value) {
  lines.push(String(code).padStart(3, " "));
  lines.push(typeof value === "number" ? value.toFixed(6) : String(value));
}

function patternPointToDxf(point) {
  const coords = pointToPattern(point);
  const toMm = els.unit.value === "cm" ? 10 : 1;
  const x = coords.x * toMm;
  const yValue = coords.y * toMm;
  return {
    x: roundCoord(x),
    y: roundCoord(state.yUp ? yValue : -yValue),
  };
}

function imagePointToDxf(point) {
  const coords = imagePointToPatternCoords(point);
  const toMm = els.unit.value === "cm" ? 10 : 1;
  const x = coords.x * toMm;
  const yValue = coords.y * toMm;
  return {
    x: roundCoord(x),
    y: roundCoord(state.yUp ? yValue : -yValue),
  };
}

function sampleEdgeForDxf(from, to, edge) {
  const controls = edgeCubicControls(edge || []);
  if (!controls) return [patternPointToDxf(from)];

  const samples = [];
  for (let step = 0; step < 16; step += 1) {
    const point = cubicPoint(from, controls.c1, controls.c2, to, step / 16);
    samples.push(imagePointToDxf(point));
  }
  return samples;
}

function faceOutlineDxfPoints(face) {
  const points = [];
  face.forEach((fromId, index) => {
    const toId = face[(index + 1) % face.length];
    const from = findPointById(fromId);
    const to = findPointById(toId);
    if (!from || !to) return;
    const edge = findEdgeBetween(fromId, toId);
    points.push(...sampleEdgeForDxf(from, to, edge));
  });
  return points;
}

function dxfPolyline(lines, layer, points, closed = true) {
  dxfPair(lines, 0, "POLYLINE");
  dxfPair(lines, 8, layer);
  dxfPair(lines, 66, 1);
  dxfPair(lines, 70, closed ? 1 : 0);
  points.forEach((point) => {
    dxfPair(lines, 0, "VERTEX");
    dxfPair(lines, 8, layer);
    dxfPair(lines, 10, point.x);
    dxfPair(lines, 20, point.y);
  });
  dxfPair(lines, 0, "SEQEND");
}

function dxfText(lines, layer, text, point, height = 8) {
  dxfPair(lines, 0, "TEXT");
  dxfPair(lines, 8, layer);
  dxfPair(lines, 10, point.x);
  dxfPair(lines, 20, point.y);
  dxfPair(lines, 40, height);
  dxfPair(lines, 50, 0);
  dxfPair(lines, 1, text);
  dxfPair(lines, 7, "STANDARD");
}

function dxfPoint(lines, layer, point) {
  dxfPair(lines, 0, "POINT");
  dxfPair(lines, 8, layer);
  dxfPair(lines, 10, point.x);
  dxfPair(lines, 20, point.y);
}

function buildDxfText() {
  const lines = [];
  const faces = state.faces.length ? state.faces : [];
  dxfPair(lines, 0, "SECTION");
  dxfPair(lines, 2, "HEADER");
  dxfPair(lines, 9, "$ACADVER");
  dxfPair(lines, 1, "AC1009");
  dxfPair(lines, 0, "ENDSEC");
  dxfPair(lines, 0, "SECTION");
  dxfPair(lines, 2, "BLOCKS");

  faces.forEach((face, index) => {
    const outline = faceOutlineDxfPoints(face);
    if (outline.length < 3) return;
    const blockName = `QUACK_TRACE_${index + 1}`;
    dxfPair(lines, 0, "BLOCK");
    dxfPair(lines, 8, "1");
    dxfPair(lines, 2, blockName);
    dxfPair(lines, 70, 64);
    dxfPair(lines, 10, 0);
    dxfPair(lines, 20, 0);
    dxfPolyline(lines, "1", outline, true);
    dxfPolyline(lines, "14", outline, true);
    outline.forEach((point) => dxfPoint(lines, "2", point));
    dxfText(lines, "1", `PIECE NAME: ${blockName}`, outline[0], 8);
    dxfText(lines, "1", "SIZE: M", { x: outline[0].x, y: outline[0].y - 10 }, 8);
    dxfText(lines, "1", "QUANTITY: 1", { x: outline[0].x, y: outline[0].y - 20 }, 8);
    dxfPair(lines, 0, "ENDBLK");
  });

  dxfPair(lines, 0, "ENDSEC");
  dxfPair(lines, 0, "SECTION");
  dxfPair(lines, 2, "ENTITIES");
  faces.forEach((face, index) => {
    if (faceOutlineDxfPoints(face).length < 3) return;
    dxfPair(lines, 0, "INSERT");
    dxfPair(lines, 8, "1");
    dxfPair(lines, 2, `QUACK_TRACE_${index + 1}`);
    dxfPair(lines, 10, 0);
    dxfPair(lines, 20, 0);
  });
  dxfText(lines, "1", "STYLE NAME: QUACK_TRACE", { x: 0, y: 0 }, 0.25);
  dxfText(lines, "1", "UNITS: METRIC", { x: 0, y: -5 }, 0.25);
  dxfPair(lines, 0, "ENDSEC");
  dxfPair(lines, 0, "EOF");
  return `${lines.join("\n")}\n`;
}

function scriptNumber(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function pythonData(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\bnull\b/g, "None")
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False");
}

function sampleEdgePatternPoints(from, to, edge, curveSteps = 16) {
  const controls = edgeCubicControls(edge || []);
  if (!controls || curveSteps <= 0) return [pointToPattern(from)];

  const samples = [];
  for (let step = 0; step < curveSteps; step += 1) {
    samples.push(imagePointToPatternCoords(cubicPoint(from, controls.c1, controls.c2, to, step / curveSteps)));
  }
  return samples;
}

function faceOutlinePatternPoints(face, curveSteps = 16) {
  const points = [];
  face.forEach((fromId, index) => {
    const toId = face[(index + 1) % face.length];
    const from = findPointById(fromId);
    const to = findPointById(toId);
    if (!from || !to) return;
    points.push(...sampleEdgePatternPoints(from, to, findEdgeBetween(fromId, toId), curveSteps));
  });
  return points;
}

function mdCloPatternData() {
  const outlines = state.faces.map((face, faceIndex) => ({
    faceIndex,
    outline: faceOutlinePatternPoints(face, 0),
  })).filter((item) => item.outline.length >= 3);
  if (outlines.length === 0) return [];

  const allPoints = outlines.flatMap((item) => item.outline);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxY = Math.max(...allPoints.map((point) => point.y));

  return outlines.map(({ faceIndex, outline }) => {
    return {
      name: `Quack Trace Piece ${faceIndex + 1}`,
      points: outline.map((point) => [
        roundCoord((point.x - minX) * 10),
        roundCoord((state.yUp ? point.y - minY : maxY - point.y) * 10),
        0,
      ]),
    };
  });
}

function mdCloPyText() {
  const patterns = mdCloPatternData();
  return [
    "import json",
    "import traceback",
    "",
    "import utility_api",
    "",
    "try:",
    "    import pattern_api",
    "except Exception:",
    "    pattern_api = None",
    "",
    `PATTERNS = ${pythonData(patterns)}`,
    "",
    "def main():",
    "    report = {",
    "        \"app\": \"Quack Trace\",",
    "        \"target\": \"Marvelous Designer / CLO\",",
    "        \"pattern_count\": len(PATTERNS),",
    "        \"ok\": False,",
    "    }",
    "    try:",
    "        if pattern_api is None:",
    "            raise RuntimeError(\"pattern_api is not available in this Python environment.\")",
    "        report[\"pattern_count_before\"] = pattern_api.GetPatternCount()",
    "        created = []",
    "        for item in PATTERNS:",
    "            points = [tuple(point) for point in item[\"points\"]]",
    "            index = pattern_api.CreatePatternWithPoints(points)",
    "            created.append(index)",
    "            try:",
    "                pattern_api.SetPatternPieceName(index, item[\"name\"])",
    "            except Exception as exc:",
    "                report.setdefault(\"name_warnings\", []).append(str(exc))",
    "        report[\"created_pattern_indices\"] = created",
    "        report[\"pattern_count_after\"] = pattern_api.GetPatternCount()",
    "        report[\"ok\"] = True",
    "        try:",
    "            utility_api.Refresh3DWindow()",
    "        except Exception:",
    "            pass",
    "        utility_api.DisplayMessageBoxW(",
    "            \"Quack Trace geometry created in Marvelous Designer / CLO.\\n\\n\"",
    "            + json.dumps(report, ensure_ascii=False, indent=2)",
    "        )",
    "    except Exception:",
    "        report[\"traceback\"] = traceback.format_exc()",
    "        utility_api.DisplayMessageBoxW(",
    "            \"Quack Trace geometry failed.\\n\\n\"",
    "            + json.dumps(report, ensure_ascii=False, indent=2)",
    "        )",
    "",
    "main()",
    "",
  ].join("\n");
}

function vectorForBlender(point, minX, maxY) {
  return [
    scriptNumber((point.x - minX) * 0.01),
    scriptNumber((maxY - point.y) * 0.01),
    0,
  ];
}

function blenderPatternData() {
  return state.faces.map((face, faceIndex) => {
    const basePoints = face.map((id) => findPointById(id)).filter(Boolean);
    const outline = faceOutlinePatternPoints(face, 16);
    if (basePoints.length < 3 || outline.length < 3) return null;

    const allPatternPoints = [
      ...basePoints.map((point) => pointToPattern(point)),
      ...outline,
    ];
    face.forEach((fromId, index) => {
      const toId = face[(index + 1) % face.length];
      const controls = edgeControlForDirection(fromId, toId);
      if (controls) {
        allPatternPoints.push(imagePointToPatternCoords(controls.c1));
        allPatternPoints.push(imagePointToPatternCoords(controls.c2));
      }
    });

    const minX = Math.min(...allPatternPoints.map((point) => point.x));
    const maxY = Math.max(...allPatternPoints.map((point) => point.y));
    const vertices = basePoints.map((point) => vectorForBlender(pointToPattern(point), minX, maxY));
    const handlesLeft = vertices.map(() => null);
    const handlesRight = vertices.map(() => null);
    const handleModes = vertices.map(() => ["VECTOR", "VECTOR"]);

    face.forEach((fromId, index) => {
      const toId = face[(index + 1) % face.length];
      const controls = edgeControlForDirection(fromId, toId);
      if (!controls) return;
      const nextIndex = (index + 1) % face.length;
      handlesRight[index] = vectorForBlender(imagePointToPatternCoords(controls.c1), minX, maxY);
      handlesLeft[nextIndex] = vectorForBlender(imagePointToPatternCoords(controls.c2), minX, maxY);
      handleModes[index][1] = "FREE";
      handleModes[nextIndex][0] = "FREE";
    });

    return {
      name: `Quack Trace Pattern ${faceIndex + 1}`,
      vertices,
      handles_left: handlesLeft,
      handles_right: handlesRight,
      handle_modes: handleModes,
      mesh_vertices: outline.map((point) => vectorForBlender(point, minX, maxY)),
    };
  }).filter(Boolean);
}

function blenderPyText() {
  const patterns = blenderPatternData();
  return [
    "import bpy",
    "from mathutils import Vector",
    "from mathutils.geometry import tessellate_polygon",
    "",
    `PATTERNS = ${pythonData(patterns)}`,
    "",
    "def make_material(name, color):",
    "    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)",
    "    material.diffuse_color = color",
    "    return material",
    "",
    "def clear_quack_trace():",
    "    for obj in list(bpy.context.scene.objects):",
    "        if obj.name.startswith(\"Quack Trace Pattern\"):",
    "            bpy.data.objects.remove(obj, do_unlink=True)",
    "",
    "def create_fill(item, index, fill_material):",
    "    vertices = [tuple(point) for point in item[\"mesh_vertices\"]]",
    "    triangles = tessellate_polygon([[Vector(point) for point in vertices]])",
    "    mesh = bpy.data.meshes.new(item[\"name\"] + \" Fill Mesh\")",
    "    mesh.from_pydata(vertices, [], triangles)",
    "    mesh.update()",
    "    obj = bpy.data.objects.new(item[\"name\"] + \" Fill\", mesh)",
    "    bpy.context.collection.objects.link(obj)",
    "    obj.data.materials.append(fill_material)",
    "    return obj",
    "",
    "def create_outline(item, outline_material):",
    "    curve = bpy.data.curves.new(item[\"name\"] + \" Outline Curve\", \"CURVE\")",
    "    curve.dimensions = \"3D\"",
    "    curve.resolution_u = 16",
    "    curve.render_resolution_u = 24",
    "    curve.fill_mode = \"FULL\"",
    "    curve.bevel_depth = 0.0006",
    "    spline = curve.splines.new(\"BEZIER\")",
    "    spline.bezier_points.add(len(item[\"vertices\"]) - 1)",
    "    spline.use_cyclic_u = True",
    "    for point_index, point in enumerate(spline.bezier_points):",
    "        point.co = item[\"vertices\"][point_index]",
    "        left_mode, right_mode = item[\"handle_modes\"][point_index]",
    "        point.handle_left_type = left_mode",
    "        point.handle_right_type = right_mode",
    "        point.handle_left = item[\"handles_left\"][point_index] or point.co",
    "        point.handle_right = item[\"handles_right\"][point_index] or point.co",
    "    obj = bpy.data.objects.new(item[\"name\"] + \" Outline\", curve)",
    "    bpy.context.collection.objects.link(obj)",
    "    obj.data.materials.append(outline_material)",
    "    return obj",
    "",
    "def main():",
    "    clear_quack_trace()",
    "    fill_material = make_material(\"Quack Trace Fill\", (0.72, 0.90, 0.94, 0.42))",
    "    outline_material = make_material(\"Quack Trace Outline\", (0.02, 0.44, 0.50, 1.0))",
    "    created = []",
    "    for index, item in enumerate(PATTERNS):",
    "        created.append(create_fill(item, index, fill_material))",
    "        created.append(create_outline(item, outline_material))",
    "    bpy.ops.object.select_all(action=\"DESELECT\")",
    "    for obj in created:",
    "        obj.select_set(True)",
    "    if created:",
    "        bpy.context.view_layer.objects.active = created[0]",
    "    try:",
    "        bpy.ops.view3d.view_axis(type=\"TOP\", align_active=False)",
    "        bpy.ops.view3d.view_selected(use_all_regions=False)",
    "    except Exception:",
    "        pass",
    "    print(\"Quack Trace Blender geometry created:\", len(created), \"objects\")",
    "",
    "main()",
    "",
  ].join("\n");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printableLineSvgText() {
  const unit = els.unit.value;
  const fromMm = (mm) => unit === "cm" ? mm / 10 : mm;
  const margin = fromMm(10);
  const scaleGap = fromMm(10);
  const scaleSize = fromMm(100);
  const scaleLabelGap = fromMm(2);
  const scaleLabelSize = fromMm(3.6);
  const strokeWidth = fromMm(0.35);
  const pointMap = new Map(state.points.map((point) => [point.id, { ...point, coords: pointToPattern(point) }]));
  const usedPoints = [];

  state.edges.forEach((edge) => {
    const from = pointMap.get(edge[0]);
    const to = pointMap.get(edge[1]);
    if (!from || !to) return;
    usedPoints.push(from.coords, to.coords);
    const controls = edgeCubicControls(edge);
    if (controls) {
      usedPoints.push(imagePointToPatternCoords(controls.c1), imagePointToPatternCoords(controls.c2));
    }
  });

  if (usedPoints.length === 0) return "";

  const drawingXs = usedPoints.map((point) => point.x);
  const drawingYs = usedPoints.map((point) => point.y);
  const drawingMinX = Math.min(...drawingXs);
  const drawingMinY = Math.min(...drawingYs);
  const drawingMaxX = Math.max(...drawingXs);
  const drawingMaxY = Math.max(...drawingYs);
  const scaleX = drawingMinX;
  const scaleY = drawingMaxY + scaleGap;
  const scaleLabel = unit === "cm" ? "10 cm" : "100 mm";
  const xs = [...drawingXs, scaleX, scaleX + scaleSize];
  const ys = [...drawingYs, scaleY - scaleLabelGap - scaleLabelSize, scaleY + scaleSize];
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  const maxX = Math.max(...xs) + margin;
  const maxY = Math.max(...ys) + margin;
  const width = Math.max(fromMm(10), maxX - minX);
  const height = Math.max(fromMm(10), maxY - minY);
  const lines = state.edges.map((edge) => {
    const from = pointMap.get(edge[0]);
    const to = pointMap.get(edge[1]);
    if (!from || !to) return "";
    const controls = edgeCubicControls(edge);
    if (controls) {
      const c1 = imagePointToPatternCoords(controls.c1);
      const c2 = imagePointToPatternCoords(controls.c2);
      return `<path d="M ${from.coords.x} ${from.coords.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.coords.x} ${to.coords.y}" />`;
    }
    return `<line x1="${from.coords.x}" y1="${from.coords.y}" x2="${to.coords.x}" y2="${to.coords.y}" />`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}${unit}" height="${height}${unit}" viewBox="${minX} ${minY} ${width} ${height}">
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />
  <g fill="none" stroke="#000000" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
  ${lines}
    <rect x="${scaleX}" y="${scaleY}" width="${scaleSize}" height="${scaleSize}" />
  </g>
  <text x="${scaleX}" y="${scaleY - scaleLabelGap}" fill="#000000" font-family="Arial, sans-serif" font-size="${scaleLabelSize}">${scaleLabel}</text>
</svg>`;
}

function printDrawing() {
  const reason = printBlockReason();
  if (reason) {
    setStatus(reason);
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setStatus(t("print.blocked"));
    return;
  }
  printWindow.opener = null;

  const title = escapeHtml(exportFileName(`${state.imageName}-pattern`, ""));
  const svg = printableLineSvgText();
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 10mm; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #000000; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    svg { display: block; background: #ffffff; }
    @media screen {
      body { padding: 16px; }
      svg { outline: 1px solid #d0d7de; }
    }
  </style>
</head>
<body>
${svg}
<script>
  let closeTimer = null;
  function closePrintWindow() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => window.close(), 250);
  }
  window.addEventListener("afterprint", closePrintWindow);
  window.addEventListener("load", () => {
    window.focus();
    setTimeout(() => window.print(), 100);
  });
</script>
</body>
</html>`;

  setStatus(t("print.preparing"));
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function sanitizedExportBaseName() {
  const raw = fileNameInput.value.trim();
  if (!raw) return "";
  const withoutKnownExtension = raw.replace(/\.(json|svg|csv|dxf|py)$/i, "");
  return withoutKnownExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
}

function exportFileName(defaultName, customSuffix) {
  const base = sanitizedExportBaseName();
  return base ? `${base}${customSuffix}` : defaultName;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);
}

function updateAll() {
  updateScaleReadout();
  renderPointList();
  updateExports();
  updateExportReadiness();
  updateCoach();
  updateUndoButton();
  updateFaceActionButtons();
  updateSelectedEdgeMeasure();
  opacityValue.textContent = `${Math.round(state.imageOpacity * 100)}%`;
  draw();
}

function normalizeCalculatorExpression(value) {
  return String(value || "")
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/,/g, "")
    .trim();
}

function evaluateCalculatorExpression(expression) {
  const source = normalizeCalculatorExpression(expression);
  let index = 0;

  function skipSpace() {
    while (/\s/.test(source[index])) index += 1;
  }

  function parseNumber() {
    skipSpace();
    let sign = 1;
    if (source[index] === "+" || source[index] === "-") {
      sign = source[index] === "-" ? -1 : 1;
      index += 1;
      skipSpace();
    }
    const start = index;
    while (/[0-9.]/.test(source[index])) index += 1;
    if (start === index) throw new Error("Expected number");
    const raw = source.slice(start, index);
    if ((raw.match(/\./g) || []).length > 1) throw new Error("Invalid number");
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error("Invalid number");
    return sign * value;
  }

  function parseFactor() {
    skipSpace();
    if (source[index] === "(") {
      index += 1;
      const value = parseExpression();
      skipSpace();
      if (source[index] !== ")") throw new Error("Expected closing parenthesis");
      index += 1;
      return value;
    }
    return parseNumber();
  }

  function parseTerm() {
    let value = parseFactor();
    while (true) {
      skipSpace();
      const operator = source[index];
      if (operator !== "*" && operator !== "/") break;
      index += 1;
      const next = parseFactor();
      value = operator === "*" ? value * next : value / next;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (true) {
      skipSpace();
      const operator = source[index];
      if (operator !== "+" && operator !== "-") break;
      index += 1;
      const next = parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  if (!source) throw new Error("Empty expression");
  const value = parseExpression();
  skipSpace();
  if (index < source.length || !Number.isFinite(value)) throw new Error("Invalid expression");
  return value;
}

function formatCalculatorNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return Number(value.toFixed(6)).toString();
}

function positionDuckCalculator() {
  if (!duckCalculator.panel || duckCalculator.panel.hidden || !duckCalculator.trigger) return;
  const triggerRect = duckCalculator.trigger.getBoundingClientRect();
  const panelRect = duckCalculator.panel.getBoundingClientRect();
  const left = Math.min(window.innerWidth - panelRect.width - 12, Math.max(12, triggerRect.left));
  const top = Math.min(window.innerHeight - panelRect.height - 12, triggerRect.bottom + 8);
  duckCalculator.panel.style.left = `${left}px`;
  duckCalculator.panel.style.top = `${top}px`;
}

function closeDuckCalculator() {
  if (!duckCalculator.panel || duckCalculator.panel.hidden) return;
  duckCalculator.panel.hidden = true;
  duckCalculator.trigger?.setAttribute("aria-expanded", "false");
}

function openDuckCalculator() {
  if (!duckCalculator.panel) return;
  duckCalculator.panel.hidden = false;
  duckCalculator.trigger?.setAttribute("aria-expanded", "true");
  positionDuckCalculator();
  duckCalculator.input?.focus();
  duckCalculator.input?.select();
}

function toggleDuckCalculator() {
  if (!duckCalculator.panel || duckCalculator.panel.hidden) {
    openDuckCalculator();
  } else {
    closeDuckCalculator();
  }
}

function playBrandQuack() {
  if (!duckQuackAudio) return;
  duckQuackAudio.pause();
  duckQuackAudio.currentTime = 0;
  duckQuackAudio.play().catch(() => {
    setStatus(state.language === "en" ? "The duck is shy right now." : "今はアヒルが鳴けませんでした。");
  });
}

function resetFromBrandDuck() {
  playBrandQuack();
  resetTrace();
}

function updateCalculatorResult() {
  if (!duckCalculator.input || !duckCalculator.resultValue) return null;
  try {
    const value = evaluateCalculatorExpression(duckCalculator.input.value);
    duckCalculator.resultValue.textContent = formatCalculatorNumber(value);
    duckCalculator.resultValue.classList.remove("is-error");
    return value;
  } catch {
    duckCalculator.resultValue.textContent = t("calculator.error");
    duckCalculator.resultValue.classList.add("is-error");
    return null;
  }
}

function useCalculatorResultAsLength() {
  const value = updateCalculatorResult();
  if (!Number.isFinite(value) || value <= 0) return;
  els.knownLength.value = formatCalculatorNumber(value);
  updateAll();
  setStatus(state.language === "en"
    ? `Known length set to ${els.knownLength.value} ${els.unit.value}.`
    : `既知の長さに ${els.knownLength.value} ${els.unit.value} を入れました。`);
}

function handleCalculatorKey(key) {
  if (!duckCalculator.input) return;
  if (key === "C") {
    duckCalculator.input.value = "";
    duckCalculator.resultValue.textContent = "--";
    duckCalculator.resultValue.classList.remove("is-error");
  } else if (key === "Back") {
    duckCalculator.input.value = duckCalculator.input.value.slice(0, -1);
  } else if (key === "=") {
    updateCalculatorResult();
  } else {
    duckCalculator.input.value += key;
  }
  duckCalculator.input.focus();
}

function handleCalculatorInputKeyDown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    updateCalculatorResult();
  } else if (event.key === "Escape") {
    closeDuckCalculator();
  }
}

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

els.imageInput.addEventListener("click", () => {
  els.imageInput.value = "";
});
els.imageInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  loadImageFile(file);
  event.target.value = "";
});
els.brandSound?.addEventListener("click", resetFromBrandDuck);
els.language.addEventListener("click", () => {
  state.language = state.language === "ja" ? "en" : "ja";
  applyLanguage();
  setStatus(statusForMode(state.mode));
});
els.sampleButton.addEventListener("click", createSampleImage);
blankGridButton.addEventListener("click", createBlankGrid);
opacityInput.addEventListener("input", () => setImageOpacity(opacityInput.value));
shapeOpacityInput.addEventListener("input", () => setShapeOpacity(shapeOpacityInput.value));
gridOpacityInput.addEventListener("input", () => setGridOpacity(gridOpacityInput.value));
pointSizeInput.addEventListener("input", () => setPointSize(pointSizeInput.value));
dxfCurveFitToggle.addEventListener("change", () => {
  if (dxfCurveFitToggle.checked) dxfStraightenCurvesToggle.checked = false;
});
dxfStraightenCurvesToggle.addEventListener("change", () => {
  if (dxfStraightenCurvesToggle.checked) dxfCurveFitToggle.checked = false;
});
dxfOriginalGuideToggle.addEventListener("change", draw);
applyScaleButton.addEventListener("click", applyCalibrationScale);
els.knownLength.addEventListener("input", updateAll);
arrowMoveInput.addEventListener("input", () => {
  const value = Number(arrowMoveInput.value);
  if (Number.isFinite(value) && value > 0) state.arrowMoveAmount = value;
});
els.fitButton.addEventListener("click", toggleFitImage);
els.undo.addEventListener("click", undoTrace);
redoButton.addEventListener("click", redoTrace);
resetButton.addEventListener("click", resetTrace);
els.connect?.addEventListener("click", connectSelected);
els.closeShape.addEventListener("click", closeSelectedShape);
guideToggleButton.addEventListener("click", toggleGuides);
pointLabelToggleButton.addEventListener("click", togglePointLabels);
canvasGridToggleButton.addEventListener("click", toggleCanvasGrid);
gridSnapToggleButton.addEventListener("click", toggleGridSnap);
scaleReferenceToggleButton.addEventListener("click", toggleScaleReference);
areaLockButton.addEventListener("click", toggleAreaLock);
straightenButton.addEventListener("click", straightenSelectedEdge);
horizontalButton.addEventListener("click", () => alignSelectedEdge("horizontal"));
verticalButton.addEventListener("click", () => alignSelectedEdge("vertical"));
flipFaceButton.addEventListener("click", flipSelectedFaceHorizontal);
deleteFaceButton.addEventListener("click", deleteSelectedFace);
els.yUp.addEventListener("change", () => {
  state.yUp = els.yUp.checked;
  updateAll();
});
els.autoConnect.addEventListener("change", () => {
  state.autoConnect = els.autoConnect.checked;
});
els.loupeMinus.addEventListener("click", () => changeLoupeZoom(-1));
els.loupePlus.addEventListener("click", () => changeLoupeZoom(1));
clearSketchButton.addEventListener("click", clearSketchGuides);
els.unit.addEventListener("change", () => {
  els.knownLengthUnit.textContent = els.unit.value;
  arrowMoveUnit.textContent = els.unit.value;
  updateAll();
});
duckCalculator.trigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDuckCalculator();
});
duckCalculator.close?.addEventListener("click", closeDuckCalculator);
duckCalculator.panel?.addEventListener("click", (event) => {
  const key = event.target.closest("[data-calc-key]")?.dataset.calcKey;
  if (key) handleCalculatorKey(key);
});
duckCalculator.input?.addEventListener("keydown", handleCalculatorInputKeyDown);
duckCalculator.useLength?.addEventListener("click", useCalculatorResultAsLength);
document.addEventListener("pointerdown", (event) => {
  if (duckCalculator.panel?.hidden) return;
  if (duckCalculator.panel?.contains(event.target) || duckCalculator.trigger?.contains(event.target)) return;
  closeDuckCalculator();
});
els.copyJson.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.exportText.value);
  setStatus(state.language === "en" ? "Copied JSON." : "JSONをコピーしました。");
});
importJsonButton.addEventListener("click", () => {
  importJsonInput.value = "";
  importJsonInput.click();
});
importDxfButton.addEventListener("click", () => {
  importDxfInput.value = "";
  importDxfInput.click();
});
importJsonInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importQuackTraceJson(JSON.parse(String(reader.result)));
    } catch (error) {
      setStatus(`JSON読込に失敗しました: ${error.message}`);
    }
  };
  reader.onerror = () => setStatus("JSONファイルを読み込めませんでした。");
  reader.readAsText(file);
});
importDxfInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importDxfText(String(reader.result), file.name);
    } catch (error) {
      setStatus(`DXF実験読込に失敗しました: ${error.message}`);
    }
  };
  reader.onerror = () => setStatus("DXFファイルを読み込めませんでした。");
  reader.readAsText(file);
});
els.downloadJson.addEventListener("click", () => {
  download(exportFileName(`${state.imageName}-pattern.json`, ".json"), JSON.stringify(exportObject(), null, 2), "application/json");
});
els.downloadSvg.addEventListener("click", () => {
  download(exportFileName(`${state.imageName}-pattern.svg`, ".svg"), svgText(), "image/svg+xml");
});
els.downloadCsv.addEventListener("click", () => {
  download(exportFileName(`${state.imageName}-points.csv`, "-points.csv"), csvText(), "text/csv");
});
downloadDxfButton.addEventListener("click", () => {
  if (!state.cmPerPixel) {
    setStatus("DXF保存の前に、寸法モードでスケールを設定してください。");
    return;
  }
  if (state.faces.length === 0) {
    setStatus("DXF保存の前に、閉じるボタンで型紙面を閉じてください。");
    return;
  }
  download(exportFileName(`${state.imageName}-pattern.dxf`, ".dxf"), buildDxfText(), "application/dxf");
  setStatus("DXFを保存しました。CLO / Marvelous Designer / CADで読み込みを試せます。");
});
printPdfButton.addEventListener("click", printDrawing);
downloadMdCloPyButton.addEventListener("click", () => {
  if (!state.cmPerPixel) {
    setStatus("MD/CLO用py保存の前に、寸法モードでスケールを設定してください。");
    return;
  }
  if (state.faces.length === 0) {
    setStatus("MD/CLO用py保存の前に、閉じるボタンで型紙面を閉じてください。");
    return;
  }
  download(exportFileName(`${state.imageName}-md-clo-pattern.py`, "-md-clo.py"), mdCloPyText(), "text/x-python");
  setStatus("MD/CLO用Pythonを保存しました。CLO / Marvelous DesignerのPythonスクリプトに貼って試せます。");
});
downloadBlenderPyButton.addEventListener("click", () => {
  if (!state.cmPerPixel) {
    setStatus("Blender用py保存の前に、寸法モードでスケールを設定してください。");
    return;
  }
  if (state.faces.length === 0) {
    setStatus("Blender用py保存の前に、閉じるボタンで型紙面を閉じてください。");
    return;
  }
  download(exportFileName(`${state.imageName}-blender-pattern.py`, "-blender.py"), blenderPyText(), "text/x-python");
  setStatus("Blender用Pythonを保存しました。BlenderのScriptingで貼って表示確認できます。");
});

canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("mousemove", handleCanvasMouseMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });
canvas.addEventListener("auxclick", (event) => event.preventDefault());
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => {
  state.spacePanActive = false;
  canvas.classList.remove("is-view-panning-ready", "is-view-panning");
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("resize", positionDuckCalculator);

applyLanguage();
resizeCanvas();
createSampleImage();
updateCoach();
