let video;
let handPose;
let hands = [];
let recorder;
let chunks = [];
let isRecording = false;
let trackingData = [];

const connections = [
  [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]
];

function preload() {
  // maxHands: 2 설정을 통해 양손 인식을 명시적으로 허용합니다.
  handPose = ml5.handPose({ flipped: true, maxHands: 2 });
}

function setup() {
  let canvas = createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, (results) => { hands = results; });

  let btn = createButton('실험 시작 (양손 녹화 및 수집)');
  btn.position(10, 490);
  btn.mousePressed(() => toggleRecording(btn));

  let stream = canvas.elt.captureStream(30);
  recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = exportData;
}

function draw() {
  background(0);

  if (hands.length > 0) {
    // 녹화 중일 때 이번 프레임의 데이터를 담을 임시 객체
    let currentFrame = { time: millis() };

    for (let i = 0; i < hands.length; i++) {
      let hand = hands[i];
      if (hand.confidence > 0.1) {
        let side = hand.handedness; // "Left" 또는 "Right"
        
        // --- 데이터 수집 로직 (녹화 중일 때) ---
        if (isRecording) {
          hand.keypoints.forEach((pt, idx) => {
            currentFrame[`${side}_pt${idx}_x`] = pt.x;
            currentFrame[`${side}_pt${idx}_y`] = pt.y;
          });
        }

        // --- 시각화 로직 ---
        drawHand(hand, side);
      }
    }
    
    if (isRecording) trackingData.push(currentFrame);
  }

  if (isRecording) {
    fill(255, 0, 0);
    noStroke();
    circle(30, 30, 20);
    fill(255);
    textSize(16);
    text("REC - 양손 추적 중", 45, 35);
  }
}

function drawHand(hand, side) {
  strokeWeight(22);
  strokeCap(ROUND);
  strokeJoin(ROUND);
  
  // 왼손은 보라색 계열, 오른손은 노란색 계열로 구분
  let clr = side === "Left" ? color(200, 100, 255, 180) : color(255, 255, 150, 180);
  stroke(clr);
  
  noFill();
  for (let conn of connections) {
    beginShape();
    for (let index of conn) {
      vertex(hand.keypoints[index].x, hand.keypoints[index].y);
    }
    endShape();
  }

  fill(red(clr), green(clr), blue(clr), 80);
  noStroke();
  beginShape();
  [0, 5, 9, 13, 17].forEach(i => vertex(hand.keypoints[i].x, hand.keypoints[i].y));
  endShape(CLOSE);

  for (let pt of hand.keypoints) {
    fill(255);
    circle(pt.x, pt.y, 6);
  }
}

function toggleRecording(btn) {
  if (!isRecording) {
    chunks = [];
    trackingData = [];
    recorder.start();
    isRecording = true;
    btn.html('실험 종료 및 저장');
    btn.style('background-color', '#ff4444');
  } else {
    recorder.stop();
    isRecording = false;
    btn.html('실험 시작 (양손 녹화 및 수집)');
    btn.style('background-color', '#efefef');
  }
}

function exportData() {
  // 영상 저장
  let blob = new Blob(chunks, { type: 'video/webm' });
  let videoUrl = URL.createObjectURL(blob);
  let a_vid = document.createElement('a');
  a_vid.href = videoUrl;
  a_vid.download = 'dual_hand_experiment.webm';
  a_vid.click();

  // CSV 저장 (왼손/오른손 컬럼 구분)
  let table = new p5.Table();
  table.addColumn('time');
  for (let s of ['Left', 'Right']) {
    for (let i = 0; i < 21; i++) {
      table.addColumn(`${s}_pt${i}_x`);
      table.addColumn(`${s}_pt${i}_y`);
    }
  }

  for (let d of trackingData) {
    let newRow = table.addRow();
    newRow.set('time', d.time);
    for (let s of ['Left', 'Right']) {
      for (let i = 0; i < 21; i++) {
        newRow.set(`${s}_pt${i}_x`, d[`${s}_pt${i}_x`] || "");
        newRow.set(`${s}_pt${i}_y`, d[`${s}_pt${i}_y`] || "");
      }
    }
  }
  saveTable(table, 'dual_hand_data.csv');
}