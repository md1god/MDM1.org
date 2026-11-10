# MDM1.org — Global digital discovery and local AI assistant

[![Live site](https://img.shields.io/badge/live-mdm1.org-f0c060?style=flat-square)](https://mdm1.org/)
[![Assistant](https://img.shields.io/badge/try-Local%20AI%20Assistant-8b6cff?style=flat-square)](https://mdm1.org/assistant/)
[![GitHub Pages](https://github.com/md1god/MDM1.org/actions/workflows/deploy.yml/badge.svg)](https://github.com/md1god/MDM1.org/actions/workflows/deploy.yml)
[![Static site](https://img.shields.io/badge/site-static%20HTML%2FCSS%2FJS-555?style=flat-square)](https://mdm1.org/)

MDM1.org is a multilingual discovery platform for software, apps, tools, games and buildable project ideas. Its free personal assistant runs a fast catalog mode in the browser and can optionally load a small local language model through WebGPU. The assistant also generates starter code for HTML/CSS, JavaScript, Python and SQL without a paid server.

[Open the assistant](https://mdm1.org/assistant/) · [Explore Discovery](https://mdm1.org/discover/) · [Browse the catalog](https://mdm1.org/catalog/) · [Read the launch kit](docs/PRODUCT-HUNT-LAUNCH.md)

## لماذا يهم المشروع؟ | Why it matters

العثور على الأداة المناسبة لا ينبغي أن يبدأ بقائمة إعلانات طويلة. MDM1 يحول الهدف الذي يكتبه الزائر إلى اقتراحات عملية وروابط مباشرة وخطوة أولى واضحة. The project is designed for people who want to discover, compare and start using useful digital resources with less friction.

## Highlights

- **Browser-first personal assistant:** catalog recommendations work without account or paid API.
- **Optional Local AI:** WebLLM loads `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` on compatible WebGPU browsers; the first download is opt-in and cached by the browser.
- **Code Lab:** generate editable starter files for HTML/CSS, JavaScript, Python and SQL, then copy or download them.
- **Global discovery:** static, indexable pages, multilingual routes, sitemaps, `hreflang` and IndexNow workflows.
- **Open contribution path:** add tools, apps, project plans, translations, accessibility improvements and bug reports.

## Try it in 60 seconds

1. Open [mdm1.org/assistant](https://mdm1.org/assistant/).
2. Describe a goal such as “I need a free privacy tool” or “build a landing page for a task app”.
3. Use the catalog recommendations or open **Code Lab** to generate a starter file.
4. If your browser supports WebGPU, choose **تشغيل النموذج المحلي / Run local model** for more flexible private answers.

## Local development

This is a static HTML/CSS/JavaScript site. No build step is required for the assistant page:

```bash
git clone https://github.com/md1god/MDM1.org.git
cd MDM1.org
python3 -m http.server 4174
# open http://127.0.0.1:4174/assistant/
```

The optional local model is loaded from the official WebLLM CDN only after the visitor clicks the model button. Do not add API keys or private credentials to this repository.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the quickest ways to improve the catalog, assistant, translations and accessibility. For a launch-oriented overview, see [the global growth playbook](docs/GLOBAL-GROWTH-PLAYBOOK.md).

## Main routes

| Area | URL |
|---|---|
| Home | https://mdm1.org/ |
| Personal assistant | https://mdm1.org/assistant/ |
| Discovery portal | https://mdm1.org/discover/ |
| Tools | https://mdm1.org/tools/ |
| Apps | https://mdm1.org/apps/ |
| Projects and catalog | https://mdm1.org/catalog/ |
| Platform | https://mdm1.org/hub.html |
| White paper | https://mdm1.org/whitepaper.html |

## العربية

MDM1.org بوابة عالمية لاكتشاف البرمجيات والتطبيقات والأدوات والألعاب والمشاريع. تحتوي على مساعد شخصي مجاني يعمل داخل المتصفح، ووضع ذكاء اصطناعي محلي اختياري عبر WebGPU، ومختبر لتوليد أكواد HTML وJavaScript وPython وSQL. نرحب بإضافات الأدوات، الترجمات، تحسينات سهولة الاستخدام، والإبلاغ عن الأخطاء.

## Credits and transparency

The browser-local model integration uses [WebLLM](https://github.com/mlc-ai/web-llm). The model is downloaded only when the visitor opts in. MDM1 does not promise that any third-party listing, search ranking or generated code is perfect; verify important outputs before production use.
