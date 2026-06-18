# MiMo V2.5 TTS API 参考文档

> 来源: https://mimo.mi.com/models/mimo-v2.5-tts 系列页面
> 更新时间: 2026-06-18

## 通用信息

- **API 端点**: `https://api.xiaomimimo.com/v1/chat/completions`
- **认证**: `api-key` header
- **协议**: OpenAI 兼容
- **上下文长度**: 8K tokens
- **最大输出**: 8K tokens
- **RPM**: 100
- **TPM**: 10M
- **定价**: 免费（限时）

---

## 1. mimo-v2.5-tts（标准 TTS）

### 用途
基础语音合成，支持预设声音、风格指令、情感标签、多角色对话。

### 调用格式
```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "风格指令（描述声音风格/情感）" },
    { "role": "assistant", "content": "要合成的文本" }
  ],
  "audio": { "format": "wav", "voice": "Chloe" }
}
```

### 消息角色含义
- **user**: 风格指令（描述语气、情感、节奏等）
- **assistant**: 要合成的文本内容

### 可用声音（voice 参数）
- Mia: 温暖自然女声
- Chloe: 明亮活力女声
- Milo: 友好随和男声
- Dean: 低沉权威男声

### 特性
- **风格指令**: 从一句话到完整剧本格式都支持
- **内联情感标签**: `[crying]`, `[pause]`, `[sniffles]` 等
- **零指令文本理解**: 不提供风格指令时，模型自动从文本推断情感和角色
- **多角色对话**: 自动识别并切换不同声音

### 示例
```
user: "Bright, bouncy, slightly sing-song tone — like you're bursting with good news."
assistant: "Hey boss — guess what, I just got the results back and I actually passed!"
audio.voice: "Chloe"
```

---

## 2. mimo-v2.5-tts-voicedesign（声音设计）

### 用途
通过自然语言描述生成任意声音，无需参考音频。

### 调用格式
```json
{
  "model": "mimo-v2.5-tts-voicedesign",
  "messages": [
    { "role": "user", "content": "声音描述（自然语言）" },
    { "role": "assistant", "content": "要合成的文本" }
  ],
  "audio": { "format": "wav", "optimize_text_preview": true }
}
```

### 消息角色含义
- **user**: 声音描述（如 "Give me a young male tone."）
- **assistant**: 要合成的文本内容

### 注意
- **没有 voice 参数** — 声音通过 user 消息描述
- **audio.optimize_text_preview**: 建议设为 true

### 描述维度
- 年龄、性别、口音、音色、节奏、气质、录音质感

### 示例
```
user: "Heavy Russian accent, gruff middle-aged male, blunt and matter-of-fact."
assistant: "You want my opinion? Fine. This plan will not work."
audio: { format: "wav", optimize_text_preview: true }
```

### 适用场景
- 有声书制作（不同角色声音）
- 播客配音
- 游戏角色语音
- 品牌声音定制

---

## 3. mimo-v2.5-tts-voiceclone（声音克隆）

### 用途
从短音频样本克隆声音，无需训练。

### 调用格式
```json
{
  "model": "mimo-v2.5-tts-voiceclone",
  "messages": [
    { "role": "user", "content": "" },
    { "role": "assistant", "content": "要合成的文本" }
  ],
  "audio": {
    "format": "wav",
    "voice": "data:audio/wav;base64,{voice_base64}"
  }
}
```

### 消息角色含义
- **user**: 空字符串（可选：风格指令，克隆后可覆盖风格）
- **assistant**: 要合成的文本内容

### 注意
- 参考音频通过 `audio.voice` 参数传入，格式为 `data:audio/wav;base64,...`
- user 消息可以传入风格指令来覆盖克隆声音的风格

### 特性
- 几秒音频即可高保真克隆
- 零训练，即时结果
- 跨语言克隆（中文/英文参考音频均可）
- 克隆后仍支持风格指令和情感标签

---

## 4. mimo-v2.5-asr（语音识别）

> 详见 https://mimo.mi.com/models/mimo-v2.5-asr
> 用途: 语音转文字

---

## 自查：我们代码的问题

### callTTS（标准 TTS）- tts.ts:79
**问题**: user 消息传了 `"Generate speech"` 而不是风格指令。
**修复**: user 消息应为空字符串（让模型零指令理解）或传入风格描述。

### callVoiceDesign（声音设计）- tts.ts:128
**问题**: audio 配置缺少 `optimize_text_preview: true`。
**修复**: 添加 `optimize_text_preview: true`。

### callVoiceClone（声音克隆）- tts.ts:164
**基本正确**: user 消息为空，参考音频通过 voice 参数传入。
