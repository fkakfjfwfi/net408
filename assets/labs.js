/* 408 计算机网络可视化课堂 · 交互实验室
 * 每个实验室独立初始化，页面上不存在对应节点时直接跳过。
 */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
  function fmtBytes(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + " MB";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + " KB";
    return n + " B";
  }
  function fmtTime(s) {
    if (s >= 1) return s.toFixed(3) + " s";
    if (s >= 1e-3) return (s * 1e3).toFixed(3) + " ms";
    return (s * 1e6).toFixed(2) + " μs";
  }

  /* ── 1. 封装与解封装 ───────────────────────────── */
  function initEncap() {
    var stage = $("encap-stage");
    if (!stage) return;
    var rows = [
      ["应用层", "报文 message", "HTTP 请求 / DNS 查询等用户数据"],
      ["传输层", "报文段 segment", "+ TCP 首部（或 UDP 首部）"],
      ["网络层", "分组 packet", "+ IP 首部（源 IP、目的 IP、TTL…）"],
      ["数据链路层", "帧 frame", "+ 帧头（源/目的 MAC）+ 帧尾 FCS"],
      ["物理层", "比特 bit", "变成电信号/光信号/电磁波发送"]
    ];
    stage.innerHTML = rows.map(function (r, i) {
      return '<div class="encap-row" data-i="' + i + '">' +
        '<span class="layer">' + r[0] + '</span>' +
        '<span class="pdu"><b>' + r[1] + '</b>　<code>' + r[2] + '</code></span>' +
        '</div>';
    }).join("");
    var idx = -1;
    function paint() {
      stage.querySelectorAll(".encap-row").forEach(function (el) {
        el.classList.toggle("on", Number(el.getAttribute("data-i")) <= idx);
      });
      var note = $("encap-note");
      if (!note) return;
      if (idx < 0) note.textContent = "从应用层开始，点“下一层”看首部如何一层层加上去。";
      else if (idx === 4) note.textContent = "封装完成：接收端从物理层开始反向拆除首部，叫“解封装”。";
      else note.textContent = "当前到 " + rows[idx][0] + "：" + rows[idx][1] + "，" + rows[idx][2] + "。";
    }
    on("encap-next", "click", function () { if (idx < 4) idx++; paint(); });
    on("encap-reset", "click", function () { idx = -1; paint(); });
    paint();
  }

  /* ── 2. 时延计算器 ─────────────────────────────── */
  function initDelay() {
    if (!$("dly-l")) return;
    function calc() {
      var bytes = Number($("dly-l").value);
      var mbps = Number($("dly-r").value);
      var km = Number($("dly-d").value);
      var vkm = Number($("dly-v").value);
      if (!(bytes > 0) || !(mbps > 0) || !(km >= 0) || !(vkm > 0)) return;
      var bits = bytes * 8;
      var rate = mbps * 1e6;
      var tx = bits / rate;                 // 发送时延 = 数据长度 / 发送速率
      var prop = km / vkm;                  // 传播时延 = 距离 / 传播速度（km ÷ km/s）
      $("dly-tx").textContent = fmtTime(tx);
      $("dly-prop").textContent = fmtTime(prop);
      $("dly-total").textContent = fmtTime(tx + prop);
      $("dly-bdp").textContent = fmtBytes(rate * prop);
      $("dly-rtt").textContent = fmtTime(2 * prop);
      $("dly-note").textContent = "数据 " + bits + " bit，发送速率 " + mbps + " Mbps；" +
        "发送时延与传播时延相互独立，加带宽只能压缩发送时延。";
    }
    ["dly-l", "dly-r", "dly-d", "dly-v"].forEach(function (id) { on(id, "input", calc); });
    calc();
  }

  /* ── 3. 奈氏准则 & 香农定理 ─────────────────────── */
  function initCapacity() {
    if (!$("cap-w")) return;
    function rateText(bps) {
      if (bps >= 1e6) return (bps / 1e6).toFixed(3) + " Mbps";
      if (bps >= 1e3) return (bps / 1e3).toFixed(2) + " kbps";
      return bps.toFixed(0) + " bps";
    }
    function calc() {
      var wKhz = Number($("cap-w").value);
      var m = Number($("cap-m").value);
      var snrDb = Number($("cap-snr").value);
      if (!(wKhz > 0) || !(m >= 2) || !(snrDb >= 0)) return;
      var w = wKhz * 1000;
      var nyq = 2 * w * Math.log2(m);                 // 奈氏：理想无噪声
      var snr = Math.pow(10, snrDb / 10);             // dB → 倍数
      var sha = w * Math.log2(1 + snr);               // 香农：有噪声
      var limit = Math.min(nyq, sha);
      $("cap-nyq").textContent = rateText(nyq);
      $("cap-sha").textContent = rateText(sha);
      $("cap-limit").textContent = rateText(limit);
      $("cap-note").innerHTML = "S/N = <b>" + snr.toFixed(0) + "</b>（" + snrDb + " dB）。" +
        "工程上实际可达速率取两者较小值；若题目只给带宽和信噪比，就只用香农。";
    }
    ["cap-w", "cap-m", "cap-snr"].forEach(function (id) { on(id, "input", calc); on(id, "change", calc); });
    calc();
  }

  /* ── 4. CRC 校验码计算 ─────────────────────────── */
  function initCRC() {
    if (!$("crc-data")) return;
    function validBits(s) { return /^[01]+$/.test(s); }
    function remainder(data, gen) {
      var bits = (data + "0".repeat(gen.length - 1)).split("");
      for (var i = 0; i <= bits.length - gen.length; i++) {
        if (bits[i] !== "1") continue;
        for (var j = 0; j < gen.length; j++) {
          bits[i + j] = bits[i + j] === gen[j] ? "0" : "1";
        }
      }
      return bits.slice(bits.length - (gen.length - 1)).join("");
    }
    function calc() {
      var data = $("crc-data").value.replace(/\s/g, "");
      var gen = $("crc-gen").value.replace(/\s/g, "");
      var msg = $("crc-msg");
      if (!validBits(data) || !validBits(gen) || gen.length < 2 || gen[0] !== "1" || gen[gen.length - 1] !== "1") {
        msg.className = "lab-msg bad";
        msg.textContent = "请输入只含 0/1 的比特串，生成多项式必须首尾都为 1（例如 1101）。";
        $("crc-out").innerHTML = "";
        return;
      }
      var r = remainder(data, gen);
      var frame = data + r;
      msg.className = "lab-msg";
      msg.textContent = "生成多项式 " + gen.length + " 位 → 余数取 " + (gen.length - 1) + " 位。";
      $("crc-out").innerHTML =
        '<div class="bitstr">原始数据：' + data + '<br>' +
        '除数 G(x)：' + gen + '<br>' +
        '余数 R(x)：<em>' + r + '</em><br>' +
        '发送帧：' + data + '<em>' + r + '</em><br>' +
        '接收端用同一 G(x) 去除，余数为 0 才认为无差错（只能检错，不能纠错）。</div>';
    }
    on("crc-calc", "click", calc);
    ["crc-data", "crc-gen"].forEach(function (id) { on(id, "input", calc); });
    calc();
  }

  /* ── 5. 子网划分计算器 ─────────────────────────── */
  function initSubnet() {
    if (!$("sub-ip")) return;
    function parseIP(s) {
      var p = s.trim().split(".");
      if (p.length !== 4) return null;
      var n = 0;
      for (var i = 0; i < 4; i++) {
        if (!/^\d+$/.test(p[i])) return null;
        var v = Number(p[i]);
        if (v < 0 || v > 255) return null;
        n = (n * 256 + v) >>> 0;
      }
      return n;
    }
    function ipStr(n) {
      n = n >>> 0;
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
    }
    function calc() {
      var ip = parseIP($("sub-ip").value);
      var prefix = Number($("sub-prefix").value);
      var msg = $("sub-msg");
      if (ip === null || !(prefix >= 0 && prefix <= 32) || Math.floor(prefix) !== prefix) {
        msg.className = "lab-msg bad";
        msg.textContent = "IP 地址格式应为 a.b.c.d，前缀长度取 0~32 的整数。";
        $("sub-out").innerHTML = "";
        return;
      }
      var mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
      var network = (ip & mask) >>> 0;
      var broadcast = (network | (~mask >>> 0)) >>> 0;
      var total = Math.pow(2, 32 - prefix);
      var hosts = prefix >= 31 ? total : Math.max(0, total - 2);
      var first = prefix >= 31 ? network : (network + 1) >>> 0;
      var last = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
      msg.className = "lab-msg";
      msg.textContent = "掩码 " + ipStr(mask) + "，通配符 " + ipStr((~mask >>> 0)) + "。";
      $("sub-out").innerHTML =
        '<div class="kv">网络地址<b>' + ipStr(network) + "/" + prefix + "</b><small>主机位全 0</small></div>" +
        '<div class="kv">广播地址<b>' + ipStr(broadcast) + "</b><small>主机位全 1</small></div>" +
        '<div class="kv">可用主机范围<b>' + ipStr(first) + " ~ " + ipStr(last) + "</b><small>共 " + hosts + " 个可用地址</small></div>" +
        '<div class="kv">地址总数<b>' + total + "</b><small>2^(" + (32 - prefix) + ")</small></div>";
    }
    on("sub-calc", "click", calc);
    ["sub-ip", "sub-prefix"].forEach(function (id) { on(id, "input", calc); });
    calc();
  }

  /* ── 6. TCP 三次握手步骤 ───────────────────────── */
  function initHandshake() {
    var box = $("hs-steps");
    if (!box) return;
    var steps = [
      ["①", "客户端 → 服务器：SYN=1，seq=x。客户端进入 SYN_SENT，表示“我想建连接，我的初始序号是 x”。"],
      ["②", "服务器 → 客户端：SYN=1，ACK=1，seq=y，ack=x+1。服务器进入 SYN_RCVD，既同意连接又确认收到 x。"],
      ["③", "客户端 → 服务器：ACK=1，seq=x+1，ack=y+1。双方进入 ESTABLISHED，连接建立，可以开始传数据。"],
      ["④", "之后的数据传输：ACK=1，seq=x+1，ack=y+1。注意序号按字节编号，不是按报文编号。"]
    ];
    box.innerHTML = steps.map(function (s, i) {
      return '<div class="step-item" data-i="' + i + '"><b>' + s[0] + "</b>" + s[1] + "</div>";
    }).join("");
    var idx = -1;
    function paint() {
      box.querySelectorAll(".step-item").forEach(function (el) {
        el.classList.toggle("on", Number(el.getAttribute("data-i")) <= idx);
      });
      var note = $("hs-note");
      if (!note) return;
      if (idx < 0) note.textContent = "点“下一步”逐条看三次握手的报文与状态变化。";
      else if (idx === 2) note.textContent = "三次握手完成。第三次握手可以携带数据，前两次不能携带数据。";
      else if (idx === 3) note.textContent = "连接建立后，双方用 seq/ack 做可靠传输；序号回绕时要注意窗口与确认号的关系。";
      else note.textContent = "当前：第 " + (idx + 1) + " 步。";
    }
    on("hs-next", "click", function () { if (idx < steps.length - 1) idx++; paint(); });
    on("hs-reset", "click", function () { idx = -1; paint(); });
    paint();
  }

  /* ── 7. TCP 拥塞窗口模拟 ───────────────────────── */
  function initCwnd() {
    if (!$("cw-ssthresh")) return;
    function calc() {
      var ssth = Math.max(2, Math.floor(Number($("cw-ssthresh").value) || 8));
      var loss = Math.floor(Number($("cw-loss").value) || 8);
      var rounds = Math.min(30, Math.max(5, Math.floor(Number($("cw-rounds").value) || 16)));
      var mode = $("cw-mode") ? $("cw-mode").value : "timeout";
      var cwnd = 1, ssthresh = ssth, data = [], lost = false;
      for (var r = 1; r <= rounds; r++) {
        data.push({ r: r, cwnd: cwnd });
        if (!lost && r === loss) {
          // 发生拥塞：阈值减半；超时则窗口回到 1，快重传则回到新阈值
          ssthresh = Math.max(2, Math.floor(cwnd / 2));
          cwnd = mode === "fast" ? ssthresh : 1;
          lost = true;
          continue;
        }
        if (cwnd < ssthresh) cwnd = Math.min(ssthresh, cwnd * 2); // 慢开始：指数增长
        else cwnd = cwnd + 1;                                     // 拥塞避免：线性增长
      }
      drawChart(data);
      var note = $("cw-note");
      if (note) {
        var peak = data.reduce(function (m, d) { return Math.max(m, d.cwnd); }, 0);
        note.innerHTML = "初始 ssthresh=" + ssth + "，第 " + loss + " 轮" +
          (mode === "fast" ? "收到 3 个重复 ACK（快重传/快恢复）" : "超时") +
          "，阈值变为 " + ssthresh + "，峰值 cwnd=" + peak + "。";
      }
    }
    function drawChart(data) {
      var svg = $("cw-svg");
      if (!svg) return;
      var W = 760, H = 280, L = 48, R = 16, T = 18, B = 40;
      var maxY = Math.max.apply(null, data.map(function (d) { return d.cwnd; }));
      maxY = Math.max(4, maxY);
      var innerW = W - L - R, innerH = H - T - B;
      function x(r) { return L + (data.length <= 1 ? 0 : (r - 1) / (data.length - 1) * innerW); }
      function y(v) { return T + innerH - (v / maxY) * innerH; }
      var pts = data.map(function (d) { return x(d.r).toFixed(1) + "," + y(d.cwnd).toFixed(1); }).join(" ");
      var grid = "";
      for (var i = 0; i <= 4; i++) {
        var gy = T + innerH * i / 4;
        var val = Math.round(maxY * (4 - i) / 4);
        grid += '<line x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '" stroke="currentColor" stroke-opacity=".12"/>' +
          '<text x="' + (L - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="currentColor" opacity=".6">' + val + "</text>";
      }
      var dots = data.map(function (d) {
        return '<circle cx="' + x(d.r) + '" cy="' + y(d.cwnd) + '" r="3.2" fill="var(--brand)">' +
          "<title>第 " + d.r + " 轮：cwnd=" + d.cwnd + "</title></circle>";
      }).join("");
      svg.innerHTML =
        '<g color="var(--ink-3)">' + grid + "</g>" +
        '<polyline points="' + pts + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round"/>' +
        dots +
        '<text x="' + (L + innerW / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" fill="currentColor" opacity=".65">传输轮次 RTT</text>' +
        '<text x="16" y="' + (T + innerH / 2) + '" text-anchor="middle" font-size="12" fill="currentColor" opacity=".65" transform="rotate(-90 16 ' + (T + innerH / 2) + ')">cwnd（MSS）</text>';
    }
    on("cw-calc", "click", calc);
    ["cw-ssthresh", "cw-loss", "cw-rounds", "cw-mode"].forEach(function (id) { on(id, "change", calc); });
    calc();
  }

  /* ── 8. DNS 解析步骤 ───────────────────────────── */
  function initDNS() {
    var box = $("dns-steps");
    if (!box) return;
    var steps = [
      ["①", "浏览器先查自己的 DNS 缓存；没有再看操作系统缓存和 hosts 文件。"],
      ["②", "本机把查询发给本地域名服务器（递归查询：你只问它一次，它负责把答案带回来）。"],
      ["③", "本地域名服务器查缓存；没有就向根域名服务器发查询（迭代查询开始）。"],
      ["④", "根服务器不直接给 IP，只返回负责 .com 的顶级域名服务器地址。"],
      ["⑤", "本地服务器再问 .com 顶级域服务器，得到 example.com 的权威域名服务器地址。"],
      ["⑥", "本地服务器问权威域名服务器，权威服务器返回 www.example.com 的 A 记录（IP）。"],
      ["⑦", "本地服务器把结果返回给主机，并按 TTL 缓存；主机随后用该 IP 发起 TCP/HTTP 连接。"]
    ];
    box.innerHTML = steps.map(function (s, i) {
      return '<div class="step-item" data-i="' + i + '"><b>' + s[0] + "</b>" + s[1] + "</div>";
    }).join("");
    var idx = -1;
    function paint() {
      box.querySelectorAll(".step-item").forEach(function (el) {
        el.classList.toggle("on", Number(el.getAttribute("data-i")) <= idx);
      });
      var note = $("dns-note");
      if (!note) return;
      if (idx < 0) note.textContent = "点“下一步”看一次 DNS 查询到底经过哪些服务器。";
      else if (idx === 6) note.textContent = "总原则：主机→本地 DNS 通常是递归查询；本地 DNS→根/顶级/权威通常是迭代查询。";
      else note.textContent = "当前：第 " + (idx + 1) + " 步。";
    }
    on("dns-next", "click", function () { if (idx < steps.length - 1) idx++; paint(); });
    on("dns-reset", "click", function () { idx = -1; paint(); });
    paint();
  }

  initEncap();
  initDelay();
  initCapacity();
  initCRC();
  initSubnet();
  initHandshake();
  initCwnd();
  initDNS();
})();
