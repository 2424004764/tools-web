// vite.config.ts
import { defineConfig, loadEnv } from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite@4.5.14_@types+node@24._22a97f0843ce623999e90deb969a4892/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/@vitejs+plugin-vue@4.6.2_vi_5c2199a4ed6292edcac824902be6ecbc/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { createSvgIconsPlugin } from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite-plugin-svg-icons@2.0.1_e1ef0a285f0ca7417e848fabd0bd27a1/node_modules/vite-plugin-svg-icons/dist/index.mjs";
import path from "path";

// src/router/router.ts
var constantRoute = [
  //首页
  {
    path: "/",
    component: () => import("@/components/Home/Home.vue"),
    name: "home",
    meta: {
      keywords: "\u5728\u7EBF\u5DE5\u5177,\u5F00\u53D1\u8FD0\u7EF4,\u6587\u672C\u5904\u7406,\u56FE\u7247\u5904\u7406,\u6570\u636E\u56FE\u8868,\u8DA3\u5473\u4E92\u52A8,\u9009\u62E9\u968F\u673A,\u6559\u80B2\u5B66\u672F,AI\u5DE5\u5177,\u597D\u7269\u7F51\u7AD9,JSON\u8F6C\u6362,CSV,TSV,\u968F\u673A\u5BC6\u7801,UUID,\u65F6\u95F4\u6233\u8F6C\u6362,\u8FDB\u5236\u8F6C\u6362,\u5355\u4F4D\u6362\u7B97,URL\u7F16\u7801,URL\u53C2\u6570,\u6B63\u5219\u6D4B\u8BD5,Markdown,\u6587\u672C\u5BF9\u6BD4,\u6587\u672C\u53BB\u91CD,\u54C8\u5E0C,HMAC,\u6587\u4EF6\u5927\u5C0F\u8F6C\u6362,HTTP\u72B6\u6001\u7801,JWT\u89E3\u6790,Cron\u751F\u6210,HTML\u5B9E\u4F53,\u4E8C\u7EF4\u7801\u751F\u6210,\u4E8C\u7EF4\u7801\u8BC6\u522B,\u56FE\u7247\u7F16\u8F91,\u56FE\u7247\u5206\u5272,\u56FE\u7247\u8F6CBase64,\u6587\u672C\u8F6C\u56FE\u7247,\u8272\u677F,\u53D6\u8272\u5668,\u67F1\u72B6\u56FE,\u6298\u7EBF\u56FE,\u997C\u56FE,\u6563\u70B9\u56FE,\u6469\u65AF\u7535\u7801,\u8D2A\u5403\u86C7,2048,\u4FC4\u7F57\u65AF\u65B9\u5757,\u626B\u96F7,\u6253\u5730\u9F20,\u6570\u5B57\u534E\u5BB9\u9053,\u6570\u72EC,IP\u67E5\u8BE2,\u7F51\u7AD9\u4FE1\u606F,AI\u8D77\u540D,AI\u53D8\u91CF\u540D,\u6587\u751F\u56FE,AI\u7FFB\u8BD1,Postman",
      description: "\u4E00\u7AD9\u5F0F\u5728\u7EBF\u5DE5\u5177\u7BB1\uFF1A\u8986\u76D6\u5F00\u53D1\u8FD0\u7EF4\u3001\u6587\u672C\u5904\u7406\u3001\u56FE\u7247\u5904\u7406\u3001\u6570\u636E\u56FE\u8868\u3001\u8DA3\u5473\u4E92\u52A8\u3001\u9009\u62E9\u968F\u673A\u3001\u6559\u80B2\u5B66\u672F\u4E0E AI \u5DE5\u5177\uFF1B\u63D0\u4F9B JSON/CSV/TSV \u4E92\u8F6C\u3001\u968F\u673A\u5BC6\u7801/UUID\u3001\u65F6\u95F4\u6233\u4E0E\u8FDB\u5236\u8F6C\u6362\u3001\u5355\u4F4D\u6362\u7B97\u3001URL \u7F16\u89E3\u7801/\u53C2\u6570\u89E3\u6790\u3001\u6B63\u5219\u6D4B\u8BD5\u3001Markdown\u3001\u6587\u672C\u5BF9\u6BD4/\u53BB\u91CD\u3001\u54C8\u5E0C\u6821\u9A8C\u3001\u6587\u4EF6\u5927\u5C0F\u8F6C\u6362\u3001HTTP \u72B6\u6001\u7801\u3001JWT \u89E3\u6790\u3001Cron \u8868\u8FBE\u5F0F\u3001HTML \u5B9E\u4F53\u3001\u4E8C\u7EF4\u7801\u751F\u6210\u4E0E\u8BC6\u522B\u3001\u5728\u7EBF\u56FE\u7247\u7F16\u8F91/\u5206\u5272/\u8F6C Base64\u3001\u6587\u672C\u8F6C\u56FE\u7247\u3001\u8272\u677F\u53D6\u8272\u5668\u3001\u67F1\u72B6/\u6298\u7EBF/\u997C/\u6563\u70B9\u56FE\u3001\u6469\u65AF\u7535\u7801\uFF0C\u4EE5\u53CA\u8D2A\u5403\u86C7/2048/\u4FC4\u7F57\u65AF\u65B9\u5757/\u626B\u96F7/\u6253\u5730\u9F20/\u6570\u5B57\u534E\u5BB9\u9053/\u6570\u72EC\u7B49\u5C0F\u6E38\u620F\uFF0C\u53E6\u542B IP \u67E5\u8BE2\u3001\u7F51\u7AD9\u4FE1\u606F\u83B7\u53D6\u3001AI \u8D77\u540D/\u53D8\u91CF\u540D/\u6587\u751F\u56FE/\u7FFB\u8BD1\u4E0E\u5728\u7EBF\u8BF7\u6C42\u8C03\u8BD5\u7B49\u5B9E\u7528\u529F\u80FD\u3002"
    }
  },
  // 用户信息页
  {
    path: "/userinfo",
    component: () => import("@/components/Home/UserInfo.vue"),
    name: "userinfo",
    meta: {
      title: "\u7528\u6237\u4FE1\u606F",
      keywords: "\u7528\u6237\u4FE1\u606F,\u4E2A\u4EBA\u8D44\u6599,\u8D26\u6237\u8BE6\u60C5",
      description: "\u67E5\u770B\u548C\u7BA1\u7406\u60A8\u7684\u7528\u6237\u4FE1\u606F\u548C\u4E2A\u4EBA\u8D44\u6599"
    }
  },
  //工具
  {
    path: "/timetran",
    component: () => import("@/components/Tools/TimeTran/TimeTran.vue"),
    name: "timetran",
    meta: {
      title: "\u65F6\u95F4\u6233\u8F6C\u6362",
      keywords: "\u65F6\u95F4,\u65E5\u671F\u8F6C\u6362\u65F6\u95F4\u6233,Unix\u65F6\u95F4\u6233",
      description: "Unix\u65F6\u95F4\u6233\u8F6C\u6362\u53EF\u4EE5\u628AUnix\u65F6\u95F4\u8F6C\u6210\u5317\u4EAC\u65F6\u95F4\u3002"
    }
  },
  {
    path: "/md5",
    component: () => import("@/components/Tools/MD5/MD5.vue"),
    name: "MD5",
    meta: {
      title: "MD5\u5728\u7EBF\u52A0\u5BC6",
      keywords: "md5\u52A0\u5BC6\uFF0Cmd5\u5728\u7EBF\u52A0\u5BC6\uFF0Cmd5",
      description: "\u5728\u7EBFmd5\u52A0\u5BC6\uFF0C\u4E00\u952E\u751F\u6210md5\u52A0\u5BC6\u5B57\u7B26\u4E32\uFF0C\u53EF\u751F\u621016\u4F4D\u621632\u4F4Dmd5\u52A0\u5BC6\u5B57\u7B26\u4E32\uFF0Cmd5\u53CC\u91CD\u52A0\u5BC6"
    }
  },
  {
    path: "/json",
    component: () => import("@/components/Tools/JsonTran/JsonTran.vue"),
    name: "json",
    meta: {
      title: "Json\u5728\u7EBF\u8F6C\u6362",
      keywords: "json\u7F16\u8F91\u5668\uFF0Cjson\u683C\u5F0F\u5316,json\u538B\u7F29,json\u8F6C\u4E49,json\u53BB\u8F6C\u4E49",
      description: "\u63D0\u4F9B\u5B9E\u65F6\u7F16\u8F91\u548C\u9884\u89C8JSON \u6570\u636E\uFF0C\u8BED\u6CD5\u9AD8\u4EAE\u3001\u6821\u9A8C\u3001\u683C\u5F0F\u5316\u3001\u8F6C\u4E49\uFF0C\u53BB\u8F6C\u4E49\u3001\u538B\u7F29\u7B49\u529F\u80FD\uFF0C\u53EF\u4EE5\u63D0\u9AD8\u9605\u8BFB\u4FEE\u6539\u7684\u6548\u7387\u548C\u51C6\u786E\u6027"
    }
  },
  {
    path: "/csv-json",
    component: () => import("@/components/Tools/CsvJson/CsvJson.vue"),
    name: "csv-json",
    meta: {
      title: "CSV/TSV \u2194 JSON \u4E92\u8F6C",
      keywords: "CSV,TSV,JSON,\u4E92\u8F6C,\u5206\u9694\u7B26,\u5217\u5934\u63A8\u65AD",
      description: "CSV\u3001TSV \u4E0E JSON \u76F8\u4E92\u8F6C\u6362\uFF0C\u652F\u6301\u5217\u5934\u63A8\u65AD\u4E0E\u5206\u9694\u7B26\u9009\u62E9"
    }
  },
  {
    path: "/reg",
    component: () => import("@/components/Tools/RegTest/RegTest.vue"),
    name: "reg",
    meta: {
      title: "\u6B63\u5219\u8868\u8FBE\u5F0F\u6D4B\u8BD5",
      keywords: "\u6B63\u5219\u8868\u8FBE\u5F0F\u6D4B\u8BD5\u5DE5\u5177,\u5E38\u7528\u6B63\u5219\u8868\u8FBE\u5F0F,\u5728\u7EBF\u6B63\u5219\u8868\u8FBE\u5F0F",
      description: "\u6B63\u5219\u8868\u8FBE\u5F0F\u6D4B\u8BD5\u5DE5\u5177,\u5E38\u7528\u6B63\u5219\u8868\u8FBE\u5F0F,\u5728\u7EBF\u6B63\u5219\u8868\u8FBE\u5F0F"
    }
  },
  {
    path: "/cron",
    component: () => import("@/components/Tools/CronGenerator/CronGenerator.vue"),
    name: "cron",
    meta: {
      title: "Cron\u8868\u8FBE\u5F0F\u751F\u6210\u5668",
      keywords: "cron\u8868\u8FBE\u5F0F,cron\u8868\u8FBE\u5F0F\u751F\u6210\u5668,\u5B9A\u65F6\u4EFB\u52A1,\u5728\u7EBFcron",
      description: "\u5728\u7EBFCron\u8868\u8FBE\u5F0F\u751F\u6210\u5668\uFF0C\u652F\u6301\u79D2\u3001\u5206\u3001\u65F6\u3001\u65E5\u3001\u6708\u3001\u5468\u3001\u5E74\u7684\u914D\u7F6E\uFF0C\u63D0\u4F9B\u5E38\u7528\u9884\u8BBE\u6A21\u677F\u548C\u5B9E\u65F6\u9884\u89C8\u529F\u80FD"
    }
  },
  {
    path: "/unicode",
    component: () => import("@/components/Tools/Unicode/Unicode.vue"),
    name: "unicode",
    meta: {
      title: "Unicode\u8F6C\u4E2D\u6587",
      keywords: "\u5728\u7EBFUnicode\u7F16\u7801\u8F6C\u6362\uFF0C\u4E2D\u6587\u8F6CUnicode\uFF0CUnicode\u8F6C\u4E2D\u6587",
      description: "\u5728\u7EBFUnicode\u7F16\u7801\u8F6C\u6362\uFF0C\u4E2D\u6587\u8F6CUnicode\uFF0CUnicode\u8F6C\u4E2D\u6587\uFF0C\u5728\u6587\u672C\u6846\u91CC\u8F93\u5165\u8981\u8F6C\u6362\u7684\u5185\u5BB9\uFF0C\u7136\u540E\u70B9\u51FB\u8981\u8F6C\u6362\u7684\u7C7B\u578B\u6309\u94AE\uFF0C\u8F6C\u6362\u5B8C\u6210\u540E\u5373\u53EF\u770B\u5230\u5BF9\u5E94\u7684\u5185\u5BB9\u3002.."
    }
  },
  {
    path: "/wordcount",
    component: () => import("@/components/Tools/WordCount/WordCount.vue"),
    name: "wordcount",
    meta: {
      title: "\u5728\u7EBF\u5B57\u6570\u7EDF\u8BA1",
      keywords: "\u5728\u7EBF\u5B57\u6570\u8BA1\u7B97\u5668,\u8BA1\u7B97\u5B57\u6570,\u5728\u7EBF\u5B57\u6570\u7EDF\u8BA1\u5668,\u5B57\u6570\u8BA1\u6570\u5668",
      description: "\u5728\u7EBF\u5B57\u6570\u8BA1\u6570\u5668,\u4E3B\u8981\u662F\u65B9\u4FBF\u8BA1\u7B97\u5B57\u6570\uFF0C\u4EE5\u63A7\u5236\u6587\u5B57\u6570\u91CF\u7684\u5C0F\u5DE5\u5177(\u5C0F\u8BF4\u4F5C\u8005\u3001\u8BBA\u6587\u3001\u6587\u6848\u6587\u6863\u3001\u6587\u5B57\u7F16\u8F91\u5FC5\u5907\u5DE5\u5177)\u3002"
    }
  },
  {
    path: "/ip",
    component: () => import("@/components/Tools/Ip/Ip.vue"),
    name: "ip",
    meta: {
      title: "IP\u67E5\u8BE2",
      keywords: "ip,ip\u67E5\u8BE2,ip\u5730\u5740\u67E5\u8BE2,ip138,\u67E5ip,\u6211\u7684ip,\u516C\u7F51ip,ip\u5F52\u5C5E\u5730\u67E5\u8BE2",
      description: "\u516C\u7F51ip\u5730\u5740\u5F52\u5C5E\u5730\u67E5\u8BE2"
    }
  },
  {
    path: "/scaletran",
    component: () => import("@/components/Tools/ScaleTran/ScaleTran.vue"),
    name: "scaletran",
    meta: {
      title: "\u5E38\u7528\u8FDB\u5236\u8F6C\u6362",
      keywords: "\u8FDB\u5236\u8F6C\u6362,\u8FDB\u5236\u8F6C\u6362\u5DE5\u5177,10\u8FDB\u5236\u8F6C2\u8FDB\u5236,2\u8FDB\u5236\u8F6C10\u8FDB\u5236,10\u8FDB\u5236\u8F6C62\u8FDB\u5236,62\u8FDB\u5236\u8F6C10\u8FDB\u5236",
      description: "\u5E38\u7528\u8FDB\u5236\u8F6C\u6362\u5DE5\u5177\uFF0C\u652F\u630132\u8FDB\u5236\u4EE5\u4E0A\u8FDB\u5236\u8F6C\u6362"
    }
  },
  {
    path: "/signimage",
    component: () => import("@/components/Tools/SignImage/SignImage.vue"),
    name: "signimage",
    meta: {
      title: "\u5728\u7EBF\u7F16\u8F91\u56FE\u7247",
      keywords: "\u5728\u7EBF\u56FE\u7247\u88C1\u526A\uFF0C\u56FE\u7247\u6807\u6CE8\uFF0C\u56FE\u7247\u6EE4\u955C\uFF0C\u56FE\u7247\u753B\u7B14\u3001\u56FE\u7247\u65CB\u8F6C\u3001\u56FE\u7247\u6587\u5B57\uFF0C\u56FE\u7247\u7F8E,\u56FE\u7247\u5C3A\u5BF8\u8C03\u6574\u5316",
      description: "\u5728\u7EBF\u56FE\u7247\u88C1\u526A\uFF0C\u56FE\u7247\u6807\u6CE8\uFF0C\u56FE\u7247\u6EE4\u955C\uFF0C\u56FE\u7247\u753B\u7B14\u3001\u56FE\u7247\u65CB\u8F6C\u3001\u56FE\u7247\u6587\u5B57,\u56FE\u7247\u5C3A\u5BF8\u8C03\u6574\u7B49\u64CD\u4F5C"
    }
  },
  {
    path: "/randompassword",
    component: () => import("@/components/Tools/RandomPassword/RandomPassword.vue"),
    name: "random_password",
    meta: {
      title: "\u968F\u673A\u5BC6\u7801\u751F\u6210",
      keywords: "\u5728\u7EBF\u751F\u6210\u968F\u673A\u5BC6\u7801\uFF0C\u6279\u91CF\u751F\u6210\u968F\u673A\u5BC6\u7801\uFF0C\u5BC6\u7801\u751F\u6210",
      description: "\u5728\u7EBF\u968F\u673A\u5BC6\u7801\u751F\u6210"
    }
  },
  {
    path: "/urlencode",
    component: () => import("@/components/Tools/UrlEncode/UrlEncode.vue"),
    name: "urlencode",
    meta: {
      title: "URL\u7F16\u7801/\u89E3\u7801",
      keywords: "url\u7F16\u7801\uFF0Curl\u89E3\u7801\uFF0Curl\u52A0\u5BC6\uFF0Curl\u89E3\u5BC6",
      description: "\u5728\u7EBFurl\u7F16\u7801\uFF0C\u5728\u7EBFurl\u89E3\u7801\u5DE5\u5177"
    }
  },
  {
    path: "/ascii",
    component: () => import("@/components/Tools/ASCII/ASCII.vue"),
    name: "ascii",
    meta: {
      title: "ASCII\u7801\u8868",
      keywords: "ascii\uFF0Cascii\u7801\u8868,ascii\u5BF9\u7167\u8868\uFF0Cascii\u63A7\u5236\u5B57\u7B26\uFF0Cascii\u6253\u5370\u5B57\u7B26\uFF0Cascii\u6269\u5C55\u7801",
      description: "ascii\u5168\u9762\u5BF9\u7167\u8868\uFF0C\u5305\u542B\u63A7\u5236\u5B57\u7B26\uFF0C\u6253\u5370\u5B57\u7B26\uFF0C\u6269\u5C55\u7801"
    }
  },
  {
    path: "/uuid",
    component: () => import("@/components/Tools/UUID/UUID.vue"),
    name: "uuid",
    meta: {
      title: "UUID\u751F\u6210\u5668",
      keywords: "UUID\u751F\u6210\u5668",
      description: "uuid\u751F\u6210\u5668\uFF0C\u6279\u91CFuuid\u751F\u6210"
    }
  },
  {
    path: "/barrage",
    component: () => import("@/components/Tools/Barrage/Barrage.vue"),
    name: "barrage",
    meta: {
      title: "\u624B\u6301\u5F39\u5E55",
      keywords: "\u624B\u6301\u5F39\u5E55\uFF0C\u5F39\u5E55\u5DE5\u5177",
      description: "\u624B\u6301\u5F39\u5E55\u662F\u4E00\u79CD\u65B0\u578B\u7684\u4E92\u52A8\u6C9F\u901A\u5DE5\u5177\uFF0C\u53EF\u4EE5\u65B9\u4FBF\u5730\u4E3A\u5404\u79CD\u6237\u5916\u6D3B\u52A8\u3001\u6F14\u51FA\u5609\u5E74\u534E\u7B49\u6D3B\u52A8\u589E\u52A0\u8DA3\u5473\u6027\u548C\u4E92\u52A8\u6027\u3002\u624B\u6301\u5F39\u5E55\u5177\u6709\u8F7B\u4FBF\u3001\u6613\u643A\u5E26\u3001\u6613\u64CD\u4F5C\u7B49\u4F18\u70B9\uFF0C\u53EF\u4EE5\u8BA9\u6BCF\u4E2A\u53C2\u4E0E\u8005\u90FD\u53D8\u6210\u6D3B\u52A8\u7684\u4E00\u90E8\u5206\u3002\u540C\u65F6\uFF0C\u624B\u6301\u5F39\u5E55\u8FD8\u53EF\u4EE5\u901A\u8FC7\u9884\u5148\u7F16\u5199\u7684\u6587\u672C\u3001\u8868\u60C5\u7B49\u5F62\u5F0F\uFF0C\u8868\u8FBE\u53C2\u4E0E\u8005\u7684\u60C5\u611F\u548C\u60F3\u6CD5\uFF0C\u5B9E\u73B0\u6C9F\u901A\u4E92\u52A8\u3002\u5728\u793E\u4EA4\u5A92\u4F53\u65F6\u4EE3\uFF0C\u624B\u6301\u5F39\u5E55\u7684\u4F7F\u7528\u4E5F\u5E26\u6765\u4E86\u66F4\u5E7F\u6CDB\u7684\u793E\u4EA4\u6548\u5E94\uFF0C\u589E\u52A0\u4E86\u6D3B\u52A8\u7684\u4E92\u52A8\u6027\u548C\u4F20\u64AD\u5EA6\u3002\u65E0\u8BBA\u662F\u4E3E\u529E\u65B9\u8FD8\u662F\u53C2\u4E0E\u8005\uFF0C\u624B\u6301\u5F39\u5E55\u90FD\u662F\u4E00\u4E2A\u975E\u5E38\u6709\u4EF7\u503C\u7684\u4E92\u52A8\u5DE5\u5177\u3002"
    }
  },
  {
    path: "/palettes",
    component: () => import("@/components/Tools/Palettes/Palettes.vue"),
    name: "palettes",
    meta: {
      title: "\u8272\u677F",
      keywords: "\u8272\u677F\uFF0C\u989C\u8272\u677F",
      description: "\u5728\u7EBF\u590D\u5236\u989C\u8272\uFF0C\u597D\u770B\u7684\u989C\u8272\u7EC4\u5408\u8272\u677F"
    }
  },
  {
    path: "/unit",
    component: () => import("@/components/Tools/Unit/Unit.vue"),
    name: "unit",
    meta: {
      title: "\u5355\u4F4D\u8F6C\u6362",
      keywords: "\u5728\u7EBF\u5355\u4F4D\u6362\u7B97,\u957F\u5EA6\u5355\u4F4D\u6362\u7B97,\u9762\u79EF\u5355\u4F4D\u6362\u7B97,\u65F6\u95F4\u5355\u4F4D\u6362\u7B97,\u91CD\u91CF\u5355\u4F4D\u6362\u7B97,\u6E29\u5EA6\u5355\u4F4D\u6362\u7B97,\u538B\u529B\u5355\u4F4D\u6362\u7B97,\u70ED\u91CF\u5355\u4F4D\u6362\u7B97,\u529F\u7387\u5355\u4F4D\u6362\u7B97\u3002",
      description: "\u5728\u7EBF\u5355\u4F4D\u6362\u7B97,\u957F\u5EA6\u5355\u4F4D\u6362\u7B97,\u9762\u79EF\u5355\u4F4D\u6362\u7B97,\u65F6\u95F4\u5355\u4F4D\u6362\u7B97,\u91CD\u91CF\u5355\u4F4D\u6362\u7B97,\u6E29\u5EA6\u5355\u4F4D\u6362\u7B97,\u538B\u529B\u5355\u4F4D\u6362\u7B97,\u70ED\u91CF\u5355\u4F4D\u6362\u7B97,\u529F\u7387\u5355\u4F4D\u6362\u7B97\u3002"
    }
  },
  {
    path: "/qrcode",
    component: () => import("@/components/Tools/Qrcode/Qrcode.vue"),
    name: "qrcode",
    meta: {
      title: "\u4E8C\u7EF4\u7801\u751F\u6210",
      keywords: "\u4E8C\u7EF4\u7801,qrcode,\u4E8C\u7EF4\u7801\u5236\u4F5C,\u4E8C\u7EF4\u7801\u751F\u6210,\u5FAE\u4FE1\u4E8C\u7EF4\u7801",
      description: "\u5728\u7EBF\u751F\u6210\u4E8C\u7EF4\u7801,\u652F\u6301logo\u4E8C\u7EF4\u7801,\u591A\u79CD\u6837\u5F0F\u9884\u8BBE"
    }
  },
  {
    path: "/qrcode-scan",
    component: () => import("@/components/Tools/QrcodeScan/QrcodeScan.vue"),
    name: "qrcodeScan",
    meta: {
      title: "\u4E8C\u7EF4\u7801\u8BC6\u522B",
      keywords: "\u4E8C\u7EF4\u7801\u8BC6\u522B,\u4E8C\u7EF4\u7801\u626B\u63CF,qrcode\u626B\u63CF,\u4E8C\u7EF4\u7801\u8BFB\u53D6",
      description: "\u5728\u7EBF\u8BC6\u522B\u4E8C\u7EF4\u7801,\u652F\u6301\u6444\u50CF\u5934\u626B\u63CF\u3001\u56FE\u7247\u4E0A\u4F20\u3001\u62D6\u62FD\u7B49\u591A\u79CD\u65B9\u5F0F"
    }
  },
  {
    path: "/filesize",
    component: () => import("@/components/Tools/FileSize/FileSize.vue"),
    name: "fileSize",
    meta: {
      title: "\u6587\u4EF6\u5927\u5C0F\u8F6C\u6362",
      keywords: "\u6587\u4EF6\u5927\u5C0F\u8F6C\u6362,\u5B57\u8282\u8F6C\u6362,KB\u8F6C\u6362,MB\u8F6C\u6362,GB\u8F6C\u6362,TB\u8F6C\u6362",
      description: "\u5728\u7EBF\u6587\u4EF6\u5927\u5C0F\u5355\u4F4D\u8F6C\u6362\u5DE5\u5177,\u652F\u6301\u5B57\u8282\u3001KB\u3001MB\u3001GB\u3001TB\u7B49\u5355\u4F4D\u4E92\u8F6C"
    }
  },
  {
    path: "/decision",
    component: () => import("@/components/Tools/Decision/Decision.vue"),
    name: "decision",
    meta: {
      title: "\u5E2E\u6211\u51B3\u5B9A",
      keywords: "\u9009\u62E9\u56F0\u96BE\uFF0C\u96BE\u4EE5\u51B3\u5B9A\uFF0C\u4ECA\u5929\u5403\u4EC0\u4E48\uFF0C\u73B0\u5728\u505A\u4EC0\u4E48\uFF0C\u81EA\u5B9A\u4E49\u9009\u9879\u90FD\u7ED9\u4F60\u5B89\u6392\u7684\u660E\u660E\u767D\u767D",
      description: "\u9009\u62E9\u56F0\u96BE\u75C7\uFF0C\u81EA\u5B9A\u4E49\u9009\u62E9\u5185\u5BB9"
    }
  },
  {
    path: "/morse",
    component: () => import("@/components/Tools/Morse/Morse.vue"),
    name: "morse",
    meta: {
      title: "\u6469\u65AF\u7535\u7801",
      keywords: "morse\u7535\u7801,\u6469\u65AF\u7535\u7801",
      description: "\u6469\u65AF\u7535\u7801\u7F16\u7801\u89E3\u7801"
    }
  },
  {
    path: "/random",
    component: () => import("@/components/Tools/Random/Random.vue"),
    name: "random",
    meta: {
      title: "\u751F\u6210\u968F\u673A\u6570",
      keywords: "\u968F\u673A\u6570\u751F\u6210,\u968F\u673A\u6570",
      description: "\u53EF\u5B9A\u5236\u8303\u56F4\u5185\u8FDB\u884C\u968F\u673A\u6570\u5B57\uFF0C\u53EF\u7528\u4E8E\u62BD\u5956\u3001\u70B9\u540D\u7B49\u7528\u9014"
    }
  },
  {
    path: "/numbertochinese",
    component: () => import("@/components/Tools/NumberToChinese/NumberToChinese.vue"),
    name: "numberToChinese",
    meta: {
      title: "\u6570\u5B57\u8F6C\u91D1\u989D\u5927\u5199",
      keywords: "\u6570\u5B57\u8F6C\u4E2D\u6587,\u6570\u5B57\u8F6C\u5927\u5199,\u4E2D\u6587\u8F6C\u6570\u5B57,\u5927\u5199\u8F6C\u6570\u5B57,\u6570\u5B57\u4E2D\u6587\u4E92\u8F6C",
      description: "\u5728\u7EBF\u6570\u5B57\u4E00\u952E\u8F6C\u6362\u6210\u4EBA\u6C11\u5E01\u5927\u5199\uFF0C\u4E2D\u6587\u5927\u5199\u91D1\u989D\u6570\u5B57\u5E94\u7528\u6B63\u6977\u6216\u884C\u4E66\u586B\u5199"
    }
  },
  {
    path: "/diff",
    component: () => import("@/components/Tools/Diff/Diff.vue"),
    name: "diff",
    meta: {
      title: "\u6587\u672C\u5BF9\u6BD4",
      keywords: "\u4E2D\u6587\u6BD4\u5BF9,\u4EE3\u7801\u6BD4\u5BF9\uFF0C\u4EE3\u7801\u5BF9\u6BD4\uFF0C\u6587\u672C\u6BD4\u5BF9\uFF0C\u82F1\u6587\u6BD4\u5BF9",
      description: "\u6587\u672C\u5DEE\u5F02\u6BD4\u5BF9\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u3001\u4EE3\u7801\u6BD4\u5BF9"
    }
  },
  {
    path: "/markdown",
    component: () => import("@/components/Tools/Markdown/Markdown.vue"),
    name: "markdown",
    meta: {
      title: "markdown\u7F16\u8F91\u5668",
      keywords: "\u5728\u7EBF\u521B\u5EFA\u6216\u7F16\u8F91markdown, \u5B9E\u65F6\u9884\u89C8\uFF0C\u5BFC\u51FAmarkdown",
      description: "\u5728\u7EBFmarkdown\u7F16\u8F91\u5668"
    }
  },
  {
    path: "/texttoimg",
    component: () => import("@/components/Tools/TextToImg/TextToImg.vue"),
    name: "textToImg",
    meta: {
      title: "\u6587\u672C\u8F6C\u56FE\u7247",
      keywords: "\u6587\u672C\u751F\u6210\u56FE\u7247\uFF0C\u6587\u672C\u751F\u6210\u957F\u56FE\uFF0C\u63A8\u5E7F\u957F\u56FE",
      description: "\u628A\u6587\u672C\u8F6C\u6362\u6210\u56FE\u7247\uFF0C\u751F\u6210\u957F\u56FE\uFF0C\u5177\u6709\u8D85\u591A\u4E2A\u6027\u6587\u5B57\u6392\u7248"
    }
  },
  {
    path: "/webinfo",
    component: () => import("@/components/Tools/WebInfo/WebInfo.vue"),
    name: "webInfo",
    meta: {
      title: "\u7F51\u7AD9favicon\u83B7\u53D6",
      keywords: "\u83B7\u53D6\u7F51\u7AD9logo,\u83B7\u53D6\u7F51\u7AD9icon,\u83B7\u53D6\u7F51\u7AD9favicon,\u83B7\u53D6\u7F51\u7AD9\u6807\u9898,\u83B7\u53D6\u7F51\u7AD9\u5173\u952E\u8BCD,\u83B7\u53D6\u7F51\u7AD9\u63CF\u8FF0",
      description: "\u83B7\u53D6\u7F51\u7AD9logo\u3001icon\u3001favicon\u3001\u6807\u9898\u3001\u5173\u952E\u8BCD\u3001\u63CF\u8FF0\u7B49\u4FE1\u606F"
    }
  },
  {
    path: "/bar",
    component: () => import("@/components/Tools/Chart/Bar/Bar.vue"),
    name: "bar",
    meta: {
      title: "\u67F1\u72B6\u56FE",
      keywords: "\u67F1\u72B6\u56FE",
      description: "\u5728\u7EBF\u5236\u4F5C\u67F1\u72B6\u56FE\uFF0C\u50CF\u505A\u8868\u683C\u4E00\u6837\u5236\u4F5C\u53EF\u89C6\u5316\u56FE\u8868\uFF0C\u652F\u6301\u5BFC\u51FA\u9759\u6001\u6216\u52A8\u6001\u56FE\u8868"
    }
  },
  {
    path: "/line",
    component: () => import("@/components/Tools/Chart/Line/Line.vue"),
    name: "line",
    meta: {
      title: "\u6298\u7EBF\u56FE",
      keywords: "\u6298\u7EBF\u56FE",
      description: "\u5728\u7EBF\u5236\u4F5C\u6298\u7EBF\u56FE\uFF0C\u50CF\u505A\u8868\u683C\u4E00\u6837\u5236\u4F5C\u53EF\u89C6\u5316\u56FE\u8868\uFF0C\u652F\u6301\u5BFC\u51FA\u9759\u6001\u6216\u52A8\u6001\u56FE\u8868"
    }
  },
  {
    path: "/pie",
    component: () => import("@/components/Tools/Chart/Pie/Pie.vue"),
    name: "pie",
    meta: {
      title: "\u997C\u56FE",
      keywords: "\u997C\u56FE",
      description: "\u5728\u7EBF\u5236\u4F5C\u997C\u56FE\uFF0C\u50CF\u505A\u8868\u683C\u4E00\u6837\u5236\u4F5C\u53EF\u89C6\u5316\u56FE\u8868\uFF0C\u652F\u6301\u5BFC\u51FA\u9759\u6001\u6216\u52A8\u6001\u56FE\u8868"
    }
  },
  {
    path: "/scatter",
    component: () => import("@/components/Tools/Chart/Scatter/Scatter.vue"),
    name: "scatter",
    meta: {
      title: "\u6563\u70B9\u56FE",
      keywords: "\u6563\u70B9\u56FE",
      description: "\u5728\u7EBF\u5236\u4F5C\u6563\u70B9\u56FE\uFF0C\u50CF\u505A\u8868\u683C\u4E00\u6837\u5236\u4F5C\u53EF\u89C6\u5316\u56FE\u8868\uFF0C\u652F\u6301\u5BFC\u51FA\u9759\u6001\u6216\u52A8\u6001\u56FE\u8868"
    }
  },
  {
    path: "/coin",
    component: () => import("@/components/Tools/Coin/Coin.vue"),
    name: "coin",
    meta: {
      title: "\u629B\u786C\u5E01",
      keywords: "\u629B\u786C\u5E01,\u786C\u5E01",
      description: "\u5728\u7EBF\u629B\u786C\u5E01\uFF0C\u9009\u62E9\u56F0\u96BE\u90A3\u4E48\u4EA4\u7ED9\u786C\u5E01\u6765\u5E2E\u4F60\u9009\u62E9\u5427"
    }
  },
  {
    path: "/dice",
    component: () => import("@/components/Tools/Dice/Dice.vue"),
    name: "dice",
    meta: {
      title: "\u6295\u9AB0\u5B50",
      keywords: "\u6295\u9AB0\u5B50,\u9AB0\u5B50,\u81EA\u5B9A\u4E49\u9AB0\u5B50",
      description: "\u5728\u7EBF\u6295\u9AB0\u5B50\uFF0C\u53EF\u81EA\u5B9A\u4E49\u9AB0\u5B50\u6570\u91CF\uFF0C\u7B80\u5355\u597D\u7528\u7684\u9AB0\u5B50\u5DE5\u5177"
    }
  },
  {
    path: "/textremoveduplicate",
    component: () => import("@/components/Tools/TextRemoveDuplicate/TextRemoveDuplicate.vue"),
    name: "textRemoveDuplicate",
    meta: {
      title: "\u6587\u672C\u53BB\u91CD",
      keywords: "\u6587\u672C\u53BB\u91CD,\u6587\u672C\u6392\u91CD\uFF0C\u6587\u672C\u53BB\u9664\u91CD\u590D",
      description: "\u53EF\u4EE5\u5220\u9664\u6216\u53BB\u9664\u6587\u672C\u6216\u5B57\u7B26\u4E32\u4E2D\u7684\u91CD\u590D\u884C"
    }
  },
  {
    path: "/imgcut",
    component: () => import("@/components/Tools/ImgCut/ImgCut.vue"),
    name: "imgCut",
    meta: {
      title: "\u56FE\u7247\u5207\u5272",
      keywords: "\u56FE\u7247\u5206\u5272,\u56FE\u7247\u5207\u5272,\u56DB\u5BAB\u683C,\u4E5D\u5BAB\u683C,\u5341\u516D\u5BAB\u683C",
      description: "\u5C06\u56FE\u7247\u5206\u5272\u6210\u56DB\u5BAB\u683C\u3001\u4E5D\u5BAB\u683C\u3001\u5341\u516D\u5BAB\u683C\uFF0C\u652F\u6301\u81EA\u5B9A\u4E49\u884C\u4E0E\u5217"
    }
  },
  {
    path: "/httpstatuscode",
    component: () => import("@/components/Tools/HttpStatusCode/HttpStatusCode.vue"),
    name: "HttpStatusCode",
    meta: {
      title: "HTTP\u72B6\u6001\u7801",
      keywords: "http\u72B6\u6001\u7801",
      description: "\u6240\u6709http\u72B6\u6001\u5BF9\u5E94\u7684\u540D\u79F0\u548C\u542B\u4E49\u89E3\u91CA"
    }
  },
  {
    path: "/jwt",
    component: () => import("@/components/Tools/JWT/JWT.vue"),
    name: "jwt",
    meta: {
      title: "JWT\u89E3\u6790",
      keywords: "jwt\u89E3\u6790\uFF0Cjwt\u89E3\u7801\uFF0Cjson web token",
      description: "\u89E3\u6790\u548C\u89E3\u7801JSON Web Token\uFF08jwt\uFF09"
    }
  },
  {
    path: "/notes",
    component: () => import("@/components/Tools/Notes/Notes.vue"),
    name: "notes",
    meta: {
      title: "\u7B14\u8BB0\u5907\u5FD8\u5F55",
      keywords: "\u5728\u7EBF\u7B14\u8BB0,\u5907\u5FD8\u5F55,\u7B14\u8BB0\u8BB0\u5F55,\u5728\u7EBF\u8BB0\u4E8B\u672C",
      description: "\u5728\u7EBF\u7B14\u8BB0\u8BB0\u5F55\u5DE5\u5177\uFF0C\u652F\u6301\u521B\u5EFA\u3001\u7F16\u8F91\u3001\u5220\u9664\u7B14\u8BB0\uFF0C\u6570\u636E\u5B89\u5168\u5B58\u50A8"
    }
  },
  {
    path: "/htmlentity",
    component: () => import("@/components/Tools/HtmlEntity/HtmlEntity.vue"),
    name: "HtmlEntity",
    meta: {
      title: "html\u5B9E\u4F53\u8F6C\u4E49",
      keywords: "html\u5B9E\u4F53\u8F6C\u4E49",
      description: "html\u5B9E\u4F53\u8F6C\u4E49\uFF0C\u5B9E\u4F53\u8F6C\u4E49\u6210html"
    }
  },
  {
    path: "/colorpicker",
    component: () => import("@/components/Tools/ColorPicker/ColorPicker.vue"),
    name: "ColorPicker",
    meta: {
      title: "Color\u9009\u62E9\u5668",
      keywords: "\u989C\u8272\u9009\u62E9\u5668,Color\u9009\u62E9\u5668",
      description: "\u989C\u8272\u9009\u62E9\u5668\u3001\u5728\u5404\u79CD\u989C\u8272\u7A7A\u95F4\u5982\u5341\u516D\u8FDB\u5236\u3001rgb\u3001hsl\u3001css\u7B49\u7B49\u4E4B\u95F4\u8F6C\u6362\u989C\u8272"
    }
  },
  {
    path: "/asciiwordpic",
    component: () => import("@/components/Tools/ASCIIWordPic/ASCIIWordPic.vue"),
    name: "asciiWordPic",
    meta: {
      title: "ASCII\u5B57\u5F62\u751F\u6210\u5668",
      keywords: "ASCII\u753B,\u5B57\u5F62\u753B,\u5B57\u5F62\u751F\u6210\u5668",
      description: "\u5728\u7EBF\u751F\u6210\u5B57\u5F62ASCII\u753B"
    }
  },
  {
    path: "/imagetobase64",
    component: () => import("@/components/Tools/ImageToBase64/ImageToBase64.vue"),
    name: "imageToBase64",
    meta: {
      title: "\u56FE\u7247\u8F6CBase64",
      keywords: "\u56FE\u7247\u8F6Cbase64,\u56FE\u7247\u7F16\u7801,base64\u7F16\u7801,\u56FE\u7247\u8F6C\u7801",
      description: "\u5C06\u56FE\u7247\u6587\u4EF6\u8F6C\u6362\u4E3ABase64\u7F16\u7801\uFF0C\u652F\u6301\u62D6\u62FD\u4E0A\u4F20\u548C\u70B9\u51FB\u4E0A\u4F20\uFF0C\u65B9\u4FBF\u5728\u7F51\u9875\u4E2D\u4F7F\u7528\u56FE\u7247"
    }
  },
  // {
  //   path: '/jsforamt',
  //   component: () => import('@/components/Tools/JSFormat/JSFormat.vue'),
  //   name: 'JSForamt',
  //   meta: {
  //     title: "js代码格式化/压缩",
  //     keywords: 'js代码格式化,js格式化,js压缩,javascript格式化',
  //     description: 'JS格式化/压缩工具,提供在线JS格式化、JS压缩、JS混淆、JS解密',
  //   }
  // },
  // {
  //   path: '/htmlformat',
  //   component: () => import('@/components/Tools/HtmlFormat/HtmlFormat.vue'),
  //   name: 'HtmlFormat',
  //   meta: {
  //     title: "html代码格式化",
  //     keywords: 'html格式化,xml格式化',
  //     description: '提供在线html、xml格式化',
  //   }
  // },
  // {
  //   path: '/cssformat',
  //   component: () => import('@/components/Tools/CssFormat/CssFormat.vue'),
  //   name: 'CssFormat',
  //   meta: {
  //     title: "css代码格式化/压缩",
  //     keywords: 'css格式化,css压缩',
  //     description: '提供在线css格式化,在线css压缩工具',
  //   }
  // },
  {
    path: "/textedit",
    component: () => import("@/components/Tools/TextEdit/TextEdit.vue"),
    name: "TextEdit",
    meta: {
      title: "\u5728\u7EBF\u6587\u672C\u7F16\u8F91/HTML\u83B7\u53D6",
      keywords: "\u6587\u672C\u7F16\u8F91\uFF0C\u5BCC\u6587\u672C\u9884\u89C8\uFF0C\u5728\u7EBF\u7F16\u8F91\u6587\u672C\uFF0C\u6587\u672C\u7F16\u8F91\u83B7\u53D6html",
      description: "\u5728\u7EBF\u5BCC\u6587\u672C\u7F16\u8F91, html\u5B9E\u65F6\u9884\u89C8\uFF0C\u5728\u7EBF\u7F16\u8F91\u6587\u672C\uFF0C\u6587\u672C\u7F16\u8F91\u83B7\u53D6html"
    }
  },
  {
    path: "/ai-text-to-image",
    component: () => import("@/components/Tools/AiTextToImage/AiTextToImage.vue"),
    name: "AiTextToImage",
    meta: {
      title: "\u5728\u7EBF\u6587\u751F\u56FE",
      keywords: "\u5728\u7EBF\u6587\u751F\u56FE,\u6587\u751F\u56FE,\u6587\u751F\u56FE\u5DE5\u5177,\u6587\u751F\u56FE\u670D\u52A1",
      description: "\u63D0\u4F9B\u5728\u7EBF\u514D\u8D39\u65E0\u9650\u6B21\u6570\u7684\u6587\u751F\u56FE\u670D\u52A1"
    }
  },
  // {
  //   path: '/ai-text-to-speech',
  //   component: () => import('@/components/Tools/AiTextToSpeech/AiTextToSpeech.vue'),
  //   name: 'AiTextToSpeech',
  //   meta: {
  //     title: "在线文本转语音",
  //     keywords: '在线文本转语音,文本转语音,语音合成,AI语音',
  //     description: '提供在线免费无限次数的文本转语音服务',
  //   }
  // },
  // 关于
  {
    path: "/about",
    component: () => import("@/components/Home/About.vue"),
    name: "about",
    meta: {
      title: "\u5173\u4E8E",
      keywords: "\u5173\u4E8Eranblogs,\u5173\u4E8E\u5DE5\u5177\u7AD9",
      description: ""
    }
  },
  // 登录页面
  {
    path: "/login",
    component: () => import("@/components/Home/Login.vue"),
    name: "login",
    meta: {
      title: "\u7528\u6237\u767B\u5F55",
      keywords: "\u7528\u6237\u767B\u5F55,\u8D26\u53F7\u767B\u5F55,\u5DE5\u5177\u7BB1\u767B\u5F55",
      description: "Tools-Web\u5DE5\u5177\u7BB1\u7528\u6237\u767B\u5F55\u9875\u9762\uFF0C\u767B\u5F55\u540E\u4EAB\u53D7\u66F4\u591A\u4E2A\u6027\u5316\u529F\u80FD"
    }
  },
  //其他路由
  {
    path: "/404",
    component: () => import("@/components/404/404.vue"),
    name: "404",
    meta: {
      title: "404"
    }
  },
  {
    //重定向
    path: "/:pathMatch(.*)*",
    redirect: "/404",
    name: "Any"
  },
  {
    path: "/snake",
    component: () => import("@/components/Tools/Snake/Snake.vue"),
    name: "snake",
    meta: {
      title: "\u8D2A\u5403\u86C7",
      keywords: "\u8D2A\u5403\u86C7,\u5C0F\u6E38\u620F,\u4F11\u95F2\u6E38\u620F,\u952E\u76D8\u6E38\u620F",
      description: "\u7ECF\u5178\u8D2A\u5403\u86C7\u6E38\u620F\uFF0C\u652F\u6301\u952E\u76D8\u63A7\u5236\uFF0C\u6311\u6218\u4F60\u7684\u53CD\u5E94\u901F\u5EA6"
    }
  },
  {
    path: "/memory",
    component: () => import("@/components/Tools/Memory/Memory.vue"),
    name: "memory",
    meta: {
      title: "\u8BB0\u5FC6\u529B\u7FFB\u724C",
      keywords: "\u8BB0\u5FC6\u529B\u6E38\u620F,\u7FFB\u724C\u914D\u5BF9,\u8BB0\u5FC6\u8BAD\u7EC3,\u76CA\u667A\u6E38\u620F",
      description: "\u8BB0\u5FC6\u529B\u7FFB\u724C\u914D\u5BF9\u6E38\u620F\uFF0C\u8003\u9A8C\u4F60\u7684\u8BB0\u5FC6\u529B\uFF0C\u627E\u5230\u76F8\u540C\u7684\u5361\u7247\u914D\u5BF9\uFF0C\u8BAD\u7EC3\u5927\u8111\u8BB0\u5FC6\u80FD\u529B"
    }
  },
  {
    path: "/tetris",
    component: () => import("@/components/Tools/Tetris/Tetris.vue"),
    name: "tetris",
    meta: {
      title: "\u4FC4\u7F57\u65AF\u65B9\u5757",
      keywords: "\u4FC4\u7F57\u65AF\u65B9\u5757,\u76CA\u667A\u6E38\u620F,\u7A7A\u95F4\u601D\u7EF4,\u7ECF\u5178\u6E38\u620F",
      description: "\u7ECF\u5178\u4FC4\u7F57\u65AF\u65B9\u5757\u6E38\u620F\uFF0C\u8003\u9A8C\u4F60\u7684\u7A7A\u95F4\u601D\u7EF4\u548C\u53CD\u5E94\u901F\u5EA6\uFF0C\u6D88\u9664\u6A2A\u884C\u83B7\u5F97\u9AD8\u5206"
    }
  },
  {
    path: "/whackamole",
    component: () => import("@/components/Tools/WhackAMole/WhackAMole.vue"),
    name: "whackamole",
    meta: {
      title: "\u6253\u5730\u9F20",
      keywords: "\u6253\u5730\u9F20,\u8857\u673A\u6E38\u620F,\u53CD\u5E94\u901F\u5EA6,\u624B\u773C\u534F\u8C03",
      description: "\u7ECF\u5178\u6253\u5730\u9F20\u6E38\u620F\uFF0C\u8003\u9A8C\u4F60\u7684\u53CD\u5E94\u901F\u5EA6\u548C\u624B\u773C\u534F\u8C03\u80FD\u529B\uFF0C30\u79D2\u5012\u8BA1\u65F6\u6311\u6218"
    }
  },
  {
    path: "/game2048",
    component: () => import("@/components/Tools/Game2048/Game2048.vue"),
    name: "game2048",
    meta: {
      title: "2048",
      keywords: "2048,\u76CA\u667A\u6E38\u620F,\u6570\u5B57\u903B\u8F91,\u7B56\u7565\u601D\u7EF4",
      description: "\u7ECF\u51782048\u76CA\u667A\u6E38\u620F\uFF0C\u8003\u9A8C\u4F60\u7684\u7B56\u7565\u601D\u7EF4\u548C\u6570\u5B57\u903B\u8F91\u80FD\u529B\uFF0C\u901A\u8FC7\u5408\u5E76\u8FBE\u52302048"
    }
  },
  {
    path: "/minesweeper",
    component: () => import("@/components/Tools/Minesweeper/Minesweeper.vue"),
    name: "minesweeper",
    meta: {
      title: "\u626B\u96F7",
      keywords: "\u626B\u96F7,\u903B\u8F91\u63A8\u7406,\u76CA\u667A\u6E38\u620F,\u6570\u5B57\u63A8\u7406",
      description: "\u7ECF\u5178\u626B\u96F7\u6E38\u620F\uFF0C\u8003\u9A8C\u4F60\u7684\u903B\u8F91\u63A8\u7406\u80FD\u529B\uFF0C\u627E\u51FA\u6240\u6709\u5730\u96F7\u6311\u6218\u6700\u5FEB\u65F6\u95F4"
    }
  },
  {
    path: "/puzzle",
    component: () => import("@/components/Tools/Puzzle/Puzzle.vue"),
    name: "puzzle",
    meta: {
      title: "\u6570\u5B57\u534E\u5BB9\u9053",
      keywords: "\u6570\u5B57\u534E\u5BB9\u9053,\u6ED1\u5757\u6E38\u620F,\u76CA\u667A\u6E38\u620F,\u903B\u8F91\u6E38\u620F",
      description: "\u7ECF\u5178\u6570\u5B57\u534E\u5BB9\u9053\u6E38\u620F\uFF0C\u901A\u8FC7\u79FB\u52A8\u6570\u5B57\u65B9\u5757\u5C06\u6570\u5B57\u6309\u987A\u5E8F\u6392\u5217\uFF0C\u8003\u9A8C\u903B\u8F91\u601D\u7EF4\u548C\u7A7A\u95F4\u89C4\u5212\u80FD\u529B"
    }
  },
  {
    path: "/sudoku",
    component: () => import("@/components/Tools/Sudoku/Sudoku.vue"),
    name: "sudoku",
    meta: {
      title: "\u6570\u72EC\u6E38\u620F",
      keywords: "\u6570\u72EC,\u6570\u72EC\u6E38\u620F,\u5728\u7EBF\u6570\u72EC,\u6570\u72EC\u89E3\u9898",
      description: "\u7ECF\u5178\u6570\u72EC\u6E38\u620F\uFF0C\u8003\u9A8C\u903B\u8F91\u63A8\u7406\u548C\u6570\u5B57\u5206\u6790\u80FD\u529B"
    }
  },
  {
    path: "/ai-gomoku",
    component: () => import("@/components/Tools/AiGomoku/AiGomoku.vue"),
    name: "ai-gomoku",
    meta: {
      title: "AI\u4E94\u5B50\u68CB",
      keywords: "\u4E94\u5B50\u68CB,AI\u4E94\u5B50\u68CB,\u5728\u7EBF\u4E94\u5B50\u68CB,\u667A\u80FD\u4E94\u5B50\u68CB",
      description: "\u667A\u80FD\u4E94\u5B50\u68CB\u6E38\u620F\uFF0C\u4E0EAI\u5BF9\u6218\uFF0C\u8003\u9A8C\u7B56\u7565\u601D\u7EF4"
    }
  },
  {
    path: "/aihub",
    component: () => import("@/components/Tools/AiHub/AiHub.vue"),
    name: "aihub",
    meta: {
      title: "AI\u5DE5\u5177\u5BFC\u822A",
      keywords: "AI\u5DE5\u5177\u5BFC\u822A,AI\u5DE5\u5177\u96C6\u5408,AI\u7B2C\u4E09\u65B9\u5DE5\u5177,AI\u7F51\u7AD9",
      description: "\u7CBE\u9009\u7B2C\u4E09\u65B9AI\u5DE5\u5177\u5206\u7C7B\u5BFC\u822A\uFF0C\u4E00\u952E\u76F4\u8FBE\u5E38\u7528AI\u670D\u52A1\u4E0E\u7F51\u7AD9"
    }
  },
  {
    path: "/ai-variable-name",
    component: () => import("@/components/Tools/AiVariableName/AiVariableName.vue"),
    name: "ai-variable-name",
    meta: {
      title: "AI\u8D77\u53D8\u91CF\u540D",
      keywords: "AI\u53D8\u91CF\u540D,AI\u53D8\u91CF,AI\u547D\u540D,AI\u8D77\u53D8\u91CF\u540D",
      description: "\u6839\u636E\u63CF\u8FF0\u81EA\u52A8\u751F\u6210\u7B26\u5408\u547D\u540D\u89C4\u8303\u7684\u53D8\u91CF\u540D\uFF0C\u652F\u6301\u591A\u79CD\u547D\u540D\u98CE\u683C\u4E0E\u8BED\u8A00"
    }
  },
  {
    path: "/ai-name",
    component: () => import("@/components/Tools/AiName/AiName.vue"),
    name: "ai-name",
    meta: {
      title: "AI\u8D77\u540D",
      keywords: "AI\u8D77\u540D,\u8D77\u540D\u5B57,\u5B9D\u5B9D\u8D77\u540D,\u4E2D\u6587\u59D3\u540D,\u53D6\u540D",
      description: "\u8F93\u5165\u7236\u6BCD\u59D3\u6C0F\uFF0C\u9009\u62E9\u540D\u7684\u957F\u5EA6\u4E0E\u6027\u522B\uFF0C\u751F\u6210\u591A\u4E2A\u4E2D\u6587\u59D3\u540D\uFF0C\u5E76\u7ED9\u51FA\u547D\u540D\u7406\u7531"
    }
  },
  {
    path: "/postman",
    component: () => import("@/components/Tools/PostmanLite/PostmanLite.vue"),
    name: "postman",
    meta: {
      title: "\u5728\u7EBF\u8BF7\u6C42\u8C03\u8BD5",
      keywords: "\u5728\u7EBFpostman, http\u5BA2\u6237\u7AEF, \u63A5\u53E3\u8C03\u8BD5, \u8BF7\u6C42\u6784\u9020, \u8DE8\u57DFCORS",
      description: "\u7B80\u5316\u7248Postman\uFF1A\u6784\u9020HTTP\u8BF7\u6C42\u3001\u67E5\u770B\u54CD\u5E94\uFF0C\u652F\u6301JSON\u3001\u8868\u5355\u3001Raw"
    }
  },
  {
    path: "/urlparams",
    component: () => import("@/components/Tools/UrlParams/UrlParams.vue"),
    name: "urlParams",
    meta: {
      title: "URL \u53C2\u6570\u89E3\u6790/\u6784\u9020",
      keywords: "URL \u53C2\u6570\u89E3\u6790,URL \u53C2\u6570\u6784\u9020,querystring,URL \u67E5\u8BE2\u53C2\u6570",
      description: "\u4E00\u952E\u89E3\u6790 ?a=1&b=2\uFF0C\u652F\u6301\u7F16\u8F91\u540E\u91CD\u65B0\u62FC\u63A5"
    }
  },
  {
    path: "/naming-case",
    component: () => import("@/components/Tools/NamingCase/NamingCase.vue"),
    name: "naming-case",
    meta: {
      title: "\u547D\u540D\u98CE\u683C\u8F6C\u6362",
      keywords: "snake_case,camelCase,PascalCase,kebab-case,\u547D\u540D,\u98CE\u683C,\u8F6C\u6362",
      description: "snake_case\u3001camelCase\u3001PascalCase\u3001kebab-case \u76F8\u4E92\u8F6C\u6362\uFF0C\u652F\u6301\u9010\u884C\u8F6C\u6362\u4E0E\u590D\u5236"
    }
  },
  {
    path: "/hash",
    component: () => import("@/components/Tools/Hash/Hash.vue"),
    name: "hash",
    meta: {
      title: "\u54C8\u5E0C\u6821\u9A8C/HMAC",
      keywords: "SHA1,SHA256,SHA512,HMAC-SHA256,\u54C8\u5E0C,\u6458\u8981,\u6821\u9A8C",
      description: "SHA-1/256/512\u3001HMAC-SHA256\uFF0C\u652F\u6301\u6587\u672C\u4E0E\u6587\u4EF6\u6458\u8981\u8BA1\u7B97"
    }
  },
  {
    path: "/ai-translate",
    component: () => import("@/components/Tools/AiTranslate/AiTranslate.vue"),
    name: "ai-translate",
    meta: {
      title: "AI\u7FFB\u8BD1",
      keywords: "AI\u7FFB\u8BD1,\u81EA\u52A8\u68C0\u6D4B,\u591A\u8BED\u8A00\u7FFB\u8BD1,LibreTranslate",
      description: "\u652F\u6301\u591A\u8BED\u8A00\u4E92\u8BD1\uFF0C\u6E90\u8BED\u8A00\u81EA\u52A8\u68C0\u6D4B\uFF0C\u514D\u8D39\u4F7F\u7528"
    }
  },
  {
    path: "/ai-elementary-essay",
    component: () => import("@/components/Tools/AiElementaryEssay/AiElementaryEssay.vue"),
    name: "ai-elementary-essay",
    meta: {
      title: "AI\u5C0F\u5B66\u4F5C\u6587",
      keywords: "AI\u5C0F\u5B66\u4F5C\u6587,\u4F5C\u6587\u751F\u6210,\u5C0F\u5B66\u751F\u4F5C\u6587,\u5E74\u7EA7\u4F5C\u6587,\u9898\u6750\u4F5C\u6587",
      description: "\u6309\u5E74\u7EA7\u3001\u4F53\u88C1\u548C\u5173\u952E\u8BCD\u751F\u6210\u8D34\u5408\u5C0F\u5B66\u751F\u6C34\u5E73\u7684\u4F5C\u6587\uFF0C\u652F\u6301\u5B57\u6570\u3001\u98CE\u683C\u4E0E\u7ED3\u6784\u63A7\u5236"
    }
  },
  {
    path: "/ai-daily-motivation",
    component: () => import("@/components/Tools/AiDailyMotivation/AiDailyMotivation.vue"),
    name: "ai-daily-motivation",
    meta: {
      title: "AI\u6BCF\u65E5\u52B1\u5FD7\u9E21\u6C64\u6587",
      keywords: "AI\u9E21\u6C64\u6587,\u52B1\u5FD7\u9E21\u6C64\u6587,\u6BCF\u65E5\u9E21\u6C64,\u6B63\u80FD\u91CF,\u52B1\u5FD7\u8BED\u5F55",
      description: "AI\u667A\u80FD\u751F\u6210\u6BCF\u65E5\u52B1\u5FD7\u9E21\u6C64\u6587\uFF0C\u652F\u6301\u591A\u79CD\u98CE\u683C\u9009\u62E9\uFF0C\u5B9A\u65F6\u5237\u65B0\uFF0C\u4E3A\u4F60\u7684\u6BCF\u4E00\u5929\u6CE8\u5165\u6B63\u80FD\u91CF"
    }
  },
  {
    path: "/good-sites",
    component: () => import("@/components/Tools/GoodSites/GoodSites.vue"),
    name: "good-sites",
    meta: {
      title: "\u597D\u7269\u7F51\u7AD9\u5BFC\u822A",
      keywords: "\u597D\u7269\u7F51\u7AD9,\u7F51\u7AD9\u5BFC\u822A,\u4F18\u8D28\u7F51\u7AD9,\u5B9E\u7528\u7F51\u7AD9",
      description: "\u7CBE\u9009\u4F18\u8D28\u7F51\u7AD9\u5206\u7C7B\u5BFC\u822A\uFF0C\u4E00\u952E\u76F4\u8FBE\u5E38\u7528\u670D\u52A1\u4E0E\u7F51\u7AD9"
    }
  },
  {
    path: "/ai-chat",
    component: () => import("@/components/Tools/AiChat/AiChat.vue"),
    name: "ai-chat",
    meta: {
      title: "AI\u5BF9\u8BDD",
      keywords: "AI\u5BF9\u8BDD,\u667A\u80FD\u5BF9\u8BDD,AI\u52A9\u624B,\u804A\u5929\u673A\u5668\u4EBA,\u667A\u80FD\u95EE\u7B54",
      description: "\u667A\u80FDAI\u5BF9\u8BDD\u52A9\u624B\uFF0C\u652F\u6301\u591A\u8F6E\u5BF9\u8BDD\uFF0C\u63D0\u4F9B\u4E13\u4E1A\u3001\u51C6\u786E\u7684\u56DE\u7B54\uFF0C\u5E2E\u52A9\u4F60\u89E3\u51B3\u5404\u79CD\u95EE\u9898"
    }
  },
  {
    path: "/image-compress",
    component: () => import("@/components/Tools/ImageCompress/ImageCompress.vue"),
    name: "image-compress",
    meta: {
      title: "\u56FE\u7247\u538B\u7F29",
      keywords: "\u56FE\u7247\u538B\u7F29,\u5728\u7EBF\u538B\u7F29,\u56FE\u7247\u4F18\u5316,\u538B\u7F29\u56FE\u7247,\u51CF\u5C0F\u56FE\u7247\u5927\u5C0F",
      description: "\u5728\u7EBF\u56FE\u7247\u538B\u7F29\u5DE5\u5177\uFF0C\u652F\u6301JPG\u3001PNG\u3001WebP\u7B49\u683C\u5F0F\uFF0C\u53EF\u8C03\u8282\u538B\u7F29\u8D28\u91CF\uFF0C\u6709\u6548\u51CF\u5C0F\u56FE\u7247\u6587\u4EF6\u5927\u5C0F\uFF0C\u4FDD\u6301\u56FE\u7247\u8D28\u91CF"
    }
  }
];

// ssr.config.ts
import vitePluginSeoPrerender from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite-plugin-seo-prerender@0_489146577398603755f79f59968f4869/node_modules/vite-plugin-seo-prerender/dist/index.js";
function seoperender() {
  const filterPath = [
    "/:pathMatch(.*)*",
    "/404",
    // 动态强网络依赖或需要权限/设备能力
    "/ai-text-to-image",
    "/qrcode-scan",
    "/postman",
    "/ip",
    "/webinfo"
  ];
  return vitePluginSeoPrerender({
    routes: constantRoute.filter((route) => !(route.meta && route.meta.prerender === false)).map((routeConfig) => routeConfig.path).filter((path2) => !filterPath.includes(path2)),
    network: {
      timeout: 45e3
      // 预渲染等待超时时间提升到45s
      // waitFor: 'networkidle0', // 可选：等待网络空闲
    },
    concurrency: 3,
    // 并发降低，减少资源竞争
    headless: true
    // removeStyle: true
  });
}

// vite.config.ts
var __vite_injected_original_dirname = "D:\\dev\\nodejs\\tools-web";
var vite_config_default = defineConfig(({ command, mode }) => {
  let env = loadEnv(mode, process.cwd());
  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    },
    plugins: [
      vue(),
      createSvgIconsPlugin({
        // Specify the icon folder to be cached
        iconDirs: [path.resolve(process.cwd(), "src/assets/icons")],
        // Specify symbolId format
        symbolId: "icon-[dir]-[name]"
      }),
      seoperender()
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        //相对路径别名配置， 使用@替代src
        "v-code-diff": path.resolve(__vite_injected_original_dirname, "node_modules/v-code-diff/src/CodeDiff.vue")
      }
    },
    server: {
      host: env.VITE_HOST,
      proxy: {
        [env.VITE_APP_BASE_API]: {
          target: env.VITE_SERVE,
          changeOrigin: true
          // bypass(req, res, options) {
          //   const proxyUrl = new URL(options.rewrite(req.url) || '', (options.target) as string)?.href || ''
          //   req.headers['x-req-proxyUrl'] = proxyUrl;
          //   res.setHeader("x-res-proxyUrl", proxyUrl)
          // }
        },
        "/api/pollinations": {
          target: "https://image.pollinations.ai",
          changeOrigin: true,
          rewrite: (path2) => path2.replace(/^\/api\/pollinations/, ""),
          headers: {
            Authorization: "Bearer NpgaKlHjioTlyo2B"
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL3JvdXRlci9yb3V0ZXIudHMiLCAic3NyLmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXGRldlxcXFxub2RlanNcXFxcdG9vbHMtd2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxkZXZcXFxcbm9kZWpzXFxcXHRvb2xzLXdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovZGV2L25vZGVqcy90b29scy13ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcclxuaW1wb3J0IHsgY3JlYXRlU3ZnSWNvbnNQbHVnaW4gfSBmcm9tICd2aXRlLXBsdWdpbi1zdmctaWNvbnMnXHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXHJcbmltcG9ydCB7c2VvcGVyZW5kZXJ9IGZyb20gXCIuL3Nzci5jb25maWdcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoe2NvbW1hbmQsIG1vZGV9KSA9PiB7XHJcbiAgbGV0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSlcclxuICByZXR1cm4ge1xyXG4gICAgZGVmaW5lOiB7ICBcclxuICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkoJ3Byb2R1Y3Rpb24nKSAgXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICB2dWUoKSxcclxuICAgICAgY3JlYXRlU3ZnSWNvbnNQbHVnaW4oe1xyXG4gICAgICAgIC8vIFNwZWNpZnkgdGhlIGljb24gZm9sZGVyIHRvIGJlIGNhY2hlZFxyXG4gICAgICAgIGljb25EaXJzOiBbcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksICdzcmMvYXNzZXRzL2ljb25zJyldLFxyXG4gICAgICAgIC8vIFNwZWNpZnkgc3ltYm9sSWQgZm9ybWF0XHJcbiAgICAgICAgc3ltYm9sSWQ6ICdpY29uLVtkaXJdLVtuYW1lXScsXHJcbiAgICAgIH0pLFxyXG4gICAgICBzZW9wZXJlbmRlcigpXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoXCIuL3NyY1wiKSwgIC8vXHU3NkY4XHU1QkY5XHU4REVGXHU1Rjg0XHU1MjJCXHU1NDBEXHU5MTREXHU3RjZFXHVGRjBDIFx1NEY3Rlx1NzUyOEBcdTY2RkZcdTRFRTNzcmNcclxuICAgICAgICAndi1jb2RlLWRpZmYnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3YtY29kZS1kaWZmL3NyYy9Db2RlRGlmZi52dWUnKSxcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiBlbnYuVklURV9IT1NULFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgIFtlbnYuVklURV9BUFBfQkFTRV9BUEldIDoge1xyXG4gICAgICAgICAgdGFyZ2V0OiBlbnYuVklURV9TRVJWRSxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIC8vIGJ5cGFzcyhyZXEsIHJlcywgb3B0aW9ucykge1xyXG4gICAgICAgICAgLy8gICBjb25zdCBwcm94eVVybCA9IG5ldyBVUkwob3B0aW9ucy5yZXdyaXRlKHJlcS51cmwpIHx8ICcnLCAob3B0aW9ucy50YXJnZXQpIGFzIHN0cmluZyk/LmhyZWYgfHwgJydcclxuICAgICAgICAgIC8vICAgcmVxLmhlYWRlcnNbJ3gtcmVxLXByb3h5VXJsJ10gPSBwcm94eVVybDtcclxuICAgICAgICAgIC8vICAgcmVzLnNldEhlYWRlcihcIngtcmVzLXByb3h5VXJsXCIsIHByb3h5VXJsKVxyXG4gICAgICAgICAgLy8gfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJy9hcGkvcG9sbGluYXRpb25zJzoge1xyXG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9pbWFnZS5wb2xsaW5hdGlvbnMuYWknLFxyXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL3BvbGxpbmF0aW9ucy8sICcnKSxcclxuICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogJ0JlYXJlciBOcGdhS2xIamlvVGx5bzJCJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSlcclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxkZXZcXFxcbm9kZWpzXFxcXHRvb2xzLXdlYlxcXFxzcmNcXFxccm91dGVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxkZXZcXFxcbm9kZWpzXFxcXHRvb2xzLXdlYlxcXFxzcmNcXFxccm91dGVyXFxcXHJvdXRlci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovZGV2L25vZGVqcy90b29scy13ZWIvc3JjL3JvdXRlci9yb3V0ZXIudHNcIjsvL1x1NUJGOVx1NTkxNlx1NjZCNFx1OTczMlx1OTE0RFx1N0Y2RVx1OERFRlx1NzUzMShcdTVFMzhcdTkxQ0ZcdThERUZcdTc1MzEpXHJcbmV4cG9ydCBjb25zdCBjb25zdGFudFJvdXRlID0gW1xyXG4gIC8vXHU5OTk2XHU5ODc1XHJcbiAge1xyXG4gICAgcGF0aDogJy8nLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ib21lL0hvbWUudnVlJyksXHJcbiAgICBuYW1lOiAnaG9tZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIGtleXdvcmRzOiAnXHU1NzI4XHU3RUJGXHU1REU1XHU1MTc3LFx1NUYwMFx1NTNEMVx1OEZEMFx1N0VGNCxcdTY1ODdcdTY3MkNcdTU5MDRcdTc0MDYsXHU1NkZFXHU3MjQ3XHU1OTA0XHU3NDA2LFx1NjU3MFx1NjM2RVx1NTZGRVx1ODg2OCxcdThEQTNcdTU0NzNcdTRFOTJcdTUyQTgsXHU5MDA5XHU2MkU5XHU5NjhGXHU2NzNBLFx1NjU1OVx1ODBCMlx1NUI2Nlx1NjcyRixBSVx1NURFNVx1NTE3NyxcdTU5N0RcdTcyNjlcdTdGNTFcdTdBRDksSlNPTlx1OEY2Q1x1NjM2MixDU1YsVFNWLFx1OTY4Rlx1NjczQVx1NUJDNlx1NzgwMSxVVUlELFx1NjVGNlx1OTVGNFx1NjIzM1x1OEY2Q1x1NjM2MixcdThGREJcdTUyMzZcdThGNkNcdTYzNjIsXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFVSTFx1N0YxNlx1NzgwMSxVUkxcdTUzQzJcdTY1NzAsXHU2QjYzXHU1MjE5XHU2RDRCXHU4QkQ1LE1hcmtkb3duLFx1NjU4N1x1NjcyQ1x1NUJGOVx1NkJENCxcdTY1ODdcdTY3MkNcdTUzQkJcdTkxQ0QsXHU1NEM4XHU1RTBDLEhNQUMsXHU2NTg3XHU0RUY2XHU1OTI3XHU1QzBGXHU4RjZDXHU2MzYyLEhUVFBcdTcyQjZcdTYwMDFcdTc4MDEsSldUXHU4OUUzXHU2NzkwLENyb25cdTc1MUZcdTYyMTAsSFRNTFx1NUI5RVx1NEY1MyxcdTRFOENcdTdFRjRcdTc4MDFcdTc1MUZcdTYyMTAsXHU0RThDXHU3RUY0XHU3ODAxXHU4QkM2XHU1MjJCLFx1NTZGRVx1NzI0N1x1N0YxNlx1OEY5MSxcdTU2RkVcdTcyNDdcdTUyMDZcdTUyNzIsXHU1NkZFXHU3MjQ3XHU4RjZDQmFzZTY0LFx1NjU4N1x1NjcyQ1x1OEY2Q1x1NTZGRVx1NzI0NyxcdTgyNzJcdTY3N0YsXHU1M0Q2XHU4MjcyXHU1NjY4LFx1NjdGMVx1NzJCNlx1NTZGRSxcdTYyOThcdTdFQkZcdTU2RkUsXHU5OTdDXHU1NkZFLFx1NjU2M1x1NzBCOVx1NTZGRSxcdTY0NjlcdTY1QUZcdTc1MzVcdTc4MDEsXHU4RDJBXHU1NDAzXHU4NkM3LDIwNDgsXHU0RkM0XHU3RjU3XHU2NUFGXHU2NUI5XHU1NzU3LFx1NjI2Qlx1OTZGNyxcdTYyNTNcdTU3MzBcdTlGMjAsXHU2NTcwXHU1QjU3XHU1MzRFXHU1QkI5XHU5MDUzLFx1NjU3MFx1NzJFQyxJUFx1NjdFNVx1OEJFMixcdTdGNTFcdTdBRDlcdTRGRTFcdTYwNkYsQUlcdThENzdcdTU0MEQsQUlcdTUzRDhcdTkxQ0ZcdTU0MEQsXHU2NTg3XHU3NTFGXHU1NkZFLEFJXHU3RkZCXHU4QkQxLFBvc3RtYW4nLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NEUwMFx1N0FEOVx1NUYwRlx1NTcyOFx1N0VCRlx1NURFNVx1NTE3N1x1N0JCMVx1RkYxQVx1ODk4Nlx1NzZENlx1NUYwMFx1NTNEMVx1OEZEMFx1N0VGNFx1MzAwMVx1NjU4N1x1NjcyQ1x1NTkwNFx1NzQwNlx1MzAwMVx1NTZGRVx1NzI0N1x1NTkwNFx1NzQwNlx1MzAwMVx1NjU3MFx1NjM2RVx1NTZGRVx1ODg2OFx1MzAwMVx1OERBM1x1NTQ3M1x1NEU5Mlx1NTJBOFx1MzAwMVx1OTAwOVx1NjJFOVx1OTY4Rlx1NjczQVx1MzAwMVx1NjU1OVx1ODBCMlx1NUI2Nlx1NjcyRlx1NEUwRSBBSSBcdTVERTVcdTUxNzdcdUZGMUJcdTYzRDBcdTRGOUIgSlNPTi9DU1YvVFNWIFx1NEU5Mlx1OEY2Q1x1MzAwMVx1OTY4Rlx1NjczQVx1NUJDNlx1NzgwMS9VVUlEXHUzMDAxXHU2NUY2XHU5NUY0XHU2MjMzXHU0RTBFXHU4RkRCXHU1MjM2XHU4RjZDXHU2MzYyXHUzMDAxXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3XHUzMDAxVVJMIFx1N0YxNlx1ODlFM1x1NzgwMS9cdTUzQzJcdTY1NzBcdTg5RTNcdTY3OTBcdTMwMDFcdTZCNjNcdTUyMTlcdTZENEJcdThCRDVcdTMwMDFNYXJrZG93blx1MzAwMVx1NjU4N1x1NjcyQ1x1NUJGOVx1NkJENC9cdTUzQkJcdTkxQ0RcdTMwMDFcdTU0QzhcdTVFMENcdTY4MjFcdTlBOENcdTMwMDFcdTY1ODdcdTRFRjZcdTU5MjdcdTVDMEZcdThGNkNcdTYzNjJcdTMwMDFIVFRQIFx1NzJCNlx1NjAwMVx1NzgwMVx1MzAwMUpXVCBcdTg5RTNcdTY3OTBcdTMwMDFDcm9uIFx1ODg2OFx1OEZCRVx1NUYwRlx1MzAwMUhUTUwgXHU1QjlFXHU0RjUzXHUzMDAxXHU0RThDXHU3RUY0XHU3ODAxXHU3NTFGXHU2MjEwXHU0RTBFXHU4QkM2XHU1MjJCXHUzMDAxXHU1NzI4XHU3RUJGXHU1NkZFXHU3MjQ3XHU3RjE2XHU4RjkxL1x1NTIwNlx1NTI3Mi9cdThGNkMgQmFzZTY0XHUzMDAxXHU2NTg3XHU2NzJDXHU4RjZDXHU1NkZFXHU3MjQ3XHUzMDAxXHU4MjcyXHU2NzdGXHU1M0Q2XHU4MjcyXHU1NjY4XHUzMDAxXHU2N0YxXHU3MkI2L1x1NjI5OFx1N0VCRi9cdTk5N0MvXHU2NTYzXHU3MEI5XHU1NkZFXHUzMDAxXHU2NDY5XHU2NUFGXHU3NTM1XHU3ODAxXHVGRjBDXHU0RUU1XHU1M0NBXHU4RDJBXHU1NDAzXHU4NkM3LzIwNDgvXHU0RkM0XHU3RjU3XHU2NUFGXHU2NUI5XHU1NzU3L1x1NjI2Qlx1OTZGNy9cdTYyNTNcdTU3MzBcdTlGMjAvXHU2NTcwXHU1QjU3XHU1MzRFXHU1QkI5XHU5MDUzL1x1NjU3MFx1NzJFQ1x1N0I0OVx1NUMwRlx1NkUzOFx1NjIwRlx1RkYwQ1x1NTNFNlx1NTQyQiBJUCBcdTY3RTVcdThCRTJcdTMwMDFcdTdGNTFcdTdBRDlcdTRGRTFcdTYwNkZcdTgzQjdcdTUzRDZcdTMwMDFBSSBcdThENzdcdTU0MEQvXHU1M0Q4XHU5MUNGXHU1NDBEL1x1NjU4N1x1NzUxRlx1NTZGRS9cdTdGRkJcdThCRDFcdTRFMEVcdTU3MjhcdTdFQkZcdThCRjdcdTZDNDJcdThDMDNcdThCRDVcdTdCNDlcdTVCOUVcdTc1MjhcdTUyOUZcdTgwRkRcdTMwMDInXHJcbiAgICB9XHJcbiAgfSxcclxuICAvLyBcdTc1MjhcdTYyMzdcdTRGRTFcdTYwNkZcdTk4NzVcclxuICB7XHJcbiAgICBwYXRoOiAnL3VzZXJpbmZvJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvSG9tZS9Vc2VySW5mby52dWUnKSxcclxuICAgIG5hbWU6ICd1c2VyaW5mbycsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NzUyOFx1NjIzN1x1NEZFMVx1NjA2RlwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NzUyOFx1NjIzN1x1NEZFMVx1NjA2RixcdTRFMkFcdTRFQkFcdThENDRcdTY1OTksXHU4RDI2XHU2MjM3XHU4QkU2XHU2MEM1JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTY3RTVcdTc3MEJcdTU0OENcdTdCQTFcdTc0MDZcdTYwQThcdTc2ODRcdTc1MjhcdTYyMzdcdTRGRTFcdTYwNkZcdTU0OENcdTRFMkFcdTRFQkFcdThENDRcdTY1OTknLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAgLy9cdTVERTVcdTUxNzdcclxuICB7XHJcbiAgICBwYXRoOiAnL3RpbWV0cmFuJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvVGltZVRyYW4vVGltZVRyYW4udnVlJyksXHJcbiAgICBuYW1lOiAndGltZXRyYW4nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTY1RjZcdTk1RjRcdTYyMzNcdThGNkNcdTYzNjJcIixcclxuICAgICAga2V5d29yZHM6ICdcdTY1RjZcdTk1RjQsXHU2NUU1XHU2NzFGXHU4RjZDXHU2MzYyXHU2NUY2XHU5NUY0XHU2MjMzLFVuaXhcdTY1RjZcdTk1RjRcdTYyMzMnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1VuaXhcdTY1RjZcdTk1RjRcdTYyMzNcdThGNkNcdTYzNjJcdTUzRUZcdTRFRTVcdTYyOEFVbml4XHU2NUY2XHU5NUY0XHU4RjZDXHU2MjEwXHU1MzE3XHU0RUFDXHU2NUY2XHU5NUY0XHUzMDAyJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvbWQ1JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvTUQ1L01ENS52dWUnKSxcclxuICAgIG5hbWU6ICdNRDUnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJNRDVcdTU3MjhcdTdFQkZcdTUyQTBcdTVCQzZcIixcclxuICAgICAga2V5d29yZHM6ICdtZDVcdTUyQTBcdTVCQzZcdUZGMENtZDVcdTU3MjhcdTdFQkZcdTUyQTBcdTVCQzZcdUZGMENtZDUnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRm1kNVx1NTJBMFx1NUJDNlx1RkYwQ1x1NEUwMFx1OTUyRVx1NzUxRlx1NjIxMG1kNVx1NTJBMFx1NUJDNlx1NUI1N1x1N0IyNlx1NEUzMlx1RkYwQ1x1NTNFRlx1NzUxRlx1NjIxMDE2XHU0RjREXHU2MjE2MzJcdTRGNERtZDVcdTUyQTBcdTVCQzZcdTVCNTdcdTdCMjZcdTRFMzJcdUZGMENtZDVcdTUzQ0NcdTkxQ0RcdTUyQTBcdTVCQzYnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9qc29uJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvSnNvblRyYW4vSnNvblRyYW4udnVlJyksXHJcbiAgICBuYW1lOiAnanNvbicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIkpzb25cdTU3MjhcdTdFQkZcdThGNkNcdTYzNjJcIixcclxuICAgICAga2V5d29yZHM6ICdqc29uXHU3RjE2XHU4RjkxXHU1NjY4XHVGRjBDanNvblx1NjgzQ1x1NUYwRlx1NTMxNixqc29uXHU1MzhCXHU3RjI5LGpzb25cdThGNkNcdTRFNDksanNvblx1NTNCQlx1OEY2Q1x1NEU0OScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2M0QwXHU0RjlCXHU1QjlFXHU2NUY2XHU3RjE2XHU4RjkxXHU1NDhDXHU5ODg0XHU4OUM4SlNPTiBcdTY1NzBcdTYzNkVcdUZGMENcdThCRURcdTZDRDVcdTlBRDhcdTRFQUVcdTMwMDFcdTY4MjFcdTlBOENcdTMwMDFcdTY4M0NcdTVGMEZcdTUzMTZcdTMwMDFcdThGNkNcdTRFNDlcdUZGMENcdTUzQkJcdThGNkNcdTRFNDlcdTMwMDFcdTUzOEJcdTdGMjlcdTdCNDlcdTUyOUZcdTgwRkRcdUZGMENcdTUzRUZcdTRFRTVcdTYzRDBcdTlBRDhcdTk2MDVcdThCRkJcdTRGRUVcdTY1MzlcdTc2ODRcdTY1NDhcdTczODdcdTU0OENcdTUxQzZcdTc4NkVcdTYwMjcnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9jc3YtanNvbicsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0Nzdkpzb24vQ3N2SnNvbi52dWUnKSxcclxuICAgIG5hbWU6ICdjc3YtanNvbicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiAnQ1NWL1RTViBcdTIxOTQgSlNPTiBcdTRFOTJcdThGNkMnLFxyXG4gICAgICBrZXl3b3JkczogJ0NTVixUU1YsSlNPTixcdTRFOTJcdThGNkMsXHU1MjA2XHU5Njk0XHU3QjI2LFx1NTIxN1x1NTkzNFx1NjNBOFx1NjVBRCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ1NWXHUzMDAxVFNWIFx1NEUwRSBKU09OIFx1NzZGOFx1NEU5Mlx1OEY2Q1x1NjM2Mlx1RkYwQ1x1NjUyRlx1NjMwMVx1NTIxN1x1NTkzNFx1NjNBOFx1NjVBRFx1NEUwRVx1NTIwNlx1OTY5NFx1N0IyNlx1OTAwOVx1NjJFOScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3JlZycsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1JlZ1Rlc3QvUmVnVGVzdC52dWUnKSxcclxuICAgIG5hbWU6ICdyZWcnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTZCNjNcdTUyMTlcdTg4NjhcdThGQkVcdTVGMEZcdTZENEJcdThCRDVcIixcclxuICAgICAga2V5d29yZHM6ICdcdTZCNjNcdTUyMTlcdTg4NjhcdThGQkVcdTVGMEZcdTZENEJcdThCRDVcdTVERTVcdTUxNzcsXHU1RTM4XHU3NTI4XHU2QjYzXHU1MjE5XHU4ODY4XHU4RkJFXHU1RjBGLFx1NTcyOFx1N0VCRlx1NkI2M1x1NTIxOVx1ODg2OFx1OEZCRVx1NUYwRicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2QjYzXHU1MjE5XHU4ODY4XHU4RkJFXHU1RjBGXHU2RDRCXHU4QkQ1XHU1REU1XHU1MTc3LFx1NUUzOFx1NzUyOFx1NkI2M1x1NTIxOVx1ODg2OFx1OEZCRVx1NUYwRixcdTU3MjhcdTdFQkZcdTZCNjNcdTUyMTlcdTg4NjhcdThGQkVcdTVGMEYnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9jcm9uJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQ3JvbkdlbmVyYXRvci9Dcm9uR2VuZXJhdG9yLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2Nyb24nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJDcm9uXHU4ODY4XHU4RkJFXHU1RjBGXHU3NTFGXHU2MjEwXHU1NjY4XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnY3Jvblx1ODg2OFx1OEZCRVx1NUYwRixjcm9uXHU4ODY4XHU4RkJFXHU1RjBGXHU3NTFGXHU2MjEwXHU1NjY4LFx1NUI5QVx1NjVGNlx1NEVGQlx1NTJBMSxcdTU3MjhcdTdFQkZjcm9uJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZDcm9uXHU4ODY4XHU4RkJFXHU1RjBGXHU3NTFGXHU2MjEwXHU1NjY4XHVGRjBDXHU2NTJGXHU2MzAxXHU3OUQyXHUzMDAxXHU1MjA2XHUzMDAxXHU2NUY2XHUzMDAxXHU2NUU1XHUzMDAxXHU2NzA4XHUzMDAxXHU1NDY4XHUzMDAxXHU1RTc0XHU3Njg0XHU5MTREXHU3RjZFXHVGRjBDXHU2M0QwXHU0RjlCXHU1RTM4XHU3NTI4XHU5ODg0XHU4QkJFXHU2QTIxXHU2NzdGXHU1NDhDXHU1QjlFXHU2NUY2XHU5ODg0XHU4OUM4XHU1MjlGXHU4MEZEJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvdW5pY29kZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1VuaWNvZGUvVW5pY29kZS52dWUnKSxcclxuICAgIG5hbWU6ICd1bmljb2RlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiVW5pY29kZVx1OEY2Q1x1NEUyRFx1NjU4N1wiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NTcyOFx1N0VCRlVuaWNvZGVcdTdGMTZcdTc4MDFcdThGNkNcdTYzNjJcdUZGMENcdTRFMkRcdTY1ODdcdThGNkNVbmljb2RlXHVGRjBDVW5pY29kZVx1OEY2Q1x1NEUyRFx1NjU4NycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGVW5pY29kZVx1N0YxNlx1NzgwMVx1OEY2Q1x1NjM2Mlx1RkYwQ1x1NEUyRFx1NjU4N1x1OEY2Q1VuaWNvZGVcdUZGMENVbmljb2RlXHU4RjZDXHU0RTJEXHU2NTg3XHVGRjBDXHU1NzI4XHU2NTg3XHU2NzJDXHU2ODQ2XHU5MUNDXHU4RjkzXHU1MTY1XHU4OTgxXHU4RjZDXHU2MzYyXHU3Njg0XHU1MTg1XHU1QkI5XHVGRjBDXHU3MTM2XHU1NDBFXHU3MEI5XHU1MUZCXHU4OTgxXHU4RjZDXHU2MzYyXHU3Njg0XHU3QzdCXHU1NzhCXHU2MzA5XHU5NEFFXHVGRjBDXHU4RjZDXHU2MzYyXHU1QjhDXHU2MjEwXHU1NDBFXHU1MzczXHU1M0VGXHU3NzBCXHU1MjMwXHU1QkY5XHU1RTk0XHU3Njg0XHU1MTg1XHU1QkI5XHUzMDAyLi4nLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy93b3JkY291bnQnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9Xb3JkQ291bnQvV29yZENvdW50LnZ1ZScpLFxyXG4gICAgbmFtZTogJ3dvcmRjb3VudCcsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NTcyOFx1N0VCRlx1NUI1N1x1NjU3MFx1N0VERlx1OEJBMVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NTcyOFx1N0VCRlx1NUI1N1x1NjU3MFx1OEJBMVx1N0I5N1x1NTY2OCxcdThCQTFcdTdCOTdcdTVCNTdcdTY1NzAsXHU1NzI4XHU3RUJGXHU1QjU3XHU2NTcwXHU3RURGXHU4QkExXHU1NjY4LFx1NUI1N1x1NjU3MFx1OEJBMVx1NjU3MFx1NTY2OCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU1QjU3XHU2NTcwXHU4QkExXHU2NTcwXHU1NjY4LFx1NEUzQlx1ODk4MVx1NjYyRlx1NjVCOVx1NEZCRlx1OEJBMVx1N0I5N1x1NUI1N1x1NjU3MFx1RkYwQ1x1NEVFNVx1NjNBN1x1NTIzNlx1NjU4N1x1NUI1N1x1NjU3MFx1OTFDRlx1NzY4NFx1NUMwRlx1NURFNVx1NTE3NyhcdTVDMEZcdThCRjRcdTRGNUNcdTgwMDVcdTMwMDFcdThCQkFcdTY1ODdcdTMwMDFcdTY1ODdcdTY4NDhcdTY1ODdcdTY4NjNcdTMwMDFcdTY1ODdcdTVCNTdcdTdGMTZcdThGOTFcdTVGQzVcdTU5MDdcdTVERTVcdTUxNzcpXHUzMDAyJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvaXAnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9JcC9JcC52dWUnKSxcclxuICAgIG5hbWU6ICdpcCcsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIklQXHU2N0U1XHU4QkUyXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnaXAsaXBcdTY3RTVcdThCRTIsaXBcdTU3MzBcdTU3NDBcdTY3RTVcdThCRTIsaXAxMzgsXHU2N0U1aXAsXHU2MjExXHU3Njg0aXAsXHU1MTZDXHU3RjUxaXAsaXBcdTVGNTJcdTVDNUVcdTU3MzBcdTY3RTVcdThCRTInLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTE2Q1x1N0Y1MWlwXHU1NzMwXHU1NzQwXHU1RjUyXHU1QzVFXHU1NzMwXHU2N0U1XHU4QkUyJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvc2NhbGV0cmFuJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvU2NhbGVUcmFuL1NjYWxlVHJhbi52dWUnKSxcclxuICAgIG5hbWU6ICdzY2FsZXRyYW4nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTVFMzhcdTc1MjhcdThGREJcdTUyMzZcdThGNkNcdTYzNjJcIixcclxuICAgICAga2V5d29yZHM6ICdcdThGREJcdTUyMzZcdThGNkNcdTYzNjIsXHU4RkRCXHU1MjM2XHU4RjZDXHU2MzYyXHU1REU1XHU1MTc3LDEwXHU4RkRCXHU1MjM2XHU4RjZDMlx1OEZEQlx1NTIzNiwyXHU4RkRCXHU1MjM2XHU4RjZDMTBcdThGREJcdTUyMzYsMTBcdThGREJcdTUyMzZcdThGNkM2Mlx1OEZEQlx1NTIzNiw2Mlx1OEZEQlx1NTIzNlx1OEY2QzEwXHU4RkRCXHU1MjM2JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTVFMzhcdTc1MjhcdThGREJcdTUyMzZcdThGNkNcdTYzNjJcdTVERTVcdTUxNzdcdUZGMENcdTY1MkZcdTYzMDEzMlx1OEZEQlx1NTIzNlx1NEVFNVx1NEUwQVx1OEZEQlx1NTIzNlx1OEY2Q1x1NjM2MicsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3NpZ25pbWFnZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1NpZ25JbWFnZS9TaWduSW1hZ2UudnVlJyksXHJcbiAgICBuYW1lOiAnc2lnbmltYWdlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU1NzI4XHU3RUJGXHU3RjE2XHU4RjkxXHU1NkZFXHU3MjQ3XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1NzI4XHU3RUJGXHU1NkZFXHU3MjQ3XHU4OEMxXHU1MjZBXHVGRjBDXHU1NkZFXHU3MjQ3XHU2ODA3XHU2Q0U4XHVGRjBDXHU1NkZFXHU3MjQ3XHU2RUU0XHU5NTVDXHVGRjBDXHU1NkZFXHU3MjQ3XHU3NTNCXHU3QjE0XHUzMDAxXHU1NkZFXHU3MjQ3XHU2NUNCXHU4RjZDXHUzMDAxXHU1NkZFXHU3MjQ3XHU2NTg3XHU1QjU3XHVGRjBDXHU1NkZFXHU3MjQ3XHU3RjhFLFx1NTZGRVx1NzI0N1x1NUMzQVx1NUJGOFx1OEMwM1x1NjU3NFx1NTMxNicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU1NkZFXHU3MjQ3XHU4OEMxXHU1MjZBXHVGRjBDXHU1NkZFXHU3MjQ3XHU2ODA3XHU2Q0U4XHVGRjBDXHU1NkZFXHU3MjQ3XHU2RUU0XHU5NTVDXHVGRjBDXHU1NkZFXHU3MjQ3XHU3NTNCXHU3QjE0XHUzMDAxXHU1NkZFXHU3MjQ3XHU2NUNCXHU4RjZDXHUzMDAxXHU1NkZFXHU3MjQ3XHU2NTg3XHU1QjU3LFx1NTZGRVx1NzI0N1x1NUMzQVx1NUJGOFx1OEMwM1x1NjU3NFx1N0I0OVx1NjRDRFx1NEY1QycsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3JhbmRvbXBhc3N3b3JkJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvUmFuZG9tUGFzc3dvcmQvUmFuZG9tUGFzc3dvcmQudnVlJyksXHJcbiAgICBuYW1lOiAncmFuZG9tX3Bhc3N3b3JkJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU5NjhGXHU2NzNBXHU1QkM2XHU3ODAxXHU3NTFGXHU2MjEwXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1NzI4XHU3RUJGXHU3NTFGXHU2MjEwXHU5NjhGXHU2NzNBXHU1QkM2XHU3ODAxXHVGRjBDXHU2Mjc5XHU5MUNGXHU3NTFGXHU2MjEwXHU5NjhGXHU2NzNBXHU1QkM2XHU3ODAxXHVGRjBDXHU1QkM2XHU3ODAxXHU3NTFGXHU2MjEwJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZcdTk2OEZcdTY3M0FcdTVCQzZcdTc4MDFcdTc1MUZcdTYyMTAnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy91cmxlbmNvZGUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9VcmxFbmNvZGUvVXJsRW5jb2RlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3VybGVuY29kZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlVSTFx1N0YxNlx1NzgwMS9cdTg5RTNcdTc4MDFcIixcclxuICAgICAga2V5d29yZHM6ICd1cmxcdTdGMTZcdTc4MDFcdUZGMEN1cmxcdTg5RTNcdTc4MDFcdUZGMEN1cmxcdTUyQTBcdTVCQzZcdUZGMEN1cmxcdTg5RTNcdTVCQzYnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRnVybFx1N0YxNlx1NzgwMVx1RkYwQ1x1NTcyOFx1N0VCRnVybFx1ODlFM1x1NzgwMVx1NURFNVx1NTE3NycsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2FzY2lpJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQVNDSUkvQVNDSUkudnVlJyksXHJcbiAgICBuYW1lOiAnYXNjaWknLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJBU0NJSVx1NzgwMVx1ODg2OFwiLFxyXG4gICAgICBrZXl3b3JkczogJ2FzY2lpXHVGRjBDYXNjaWlcdTc4MDFcdTg4NjgsYXNjaWlcdTVCRjlcdTcxNjdcdTg4NjhcdUZGMENhc2NpaVx1NjNBN1x1NTIzNlx1NUI1N1x1N0IyNlx1RkYwQ2FzY2lpXHU2MjUzXHU1MzcwXHU1QjU3XHU3QjI2XHVGRjBDYXNjaWlcdTYyNjlcdTVDNTVcdTc4MDEnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ2FzY2lpXHU1MTY4XHU5NzYyXHU1QkY5XHU3MTY3XHU4ODY4XHVGRjBDXHU1MzA1XHU1NDJCXHU2M0E3XHU1MjM2XHU1QjU3XHU3QjI2XHVGRjBDXHU2MjUzXHU1MzcwXHU1QjU3XHU3QjI2XHVGRjBDXHU2MjY5XHU1QzU1XHU3ODAxJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvdXVpZCcsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1VVSUQvVVVJRC52dWUnKSxcclxuICAgIG5hbWU6ICd1dWlkJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiVVVJRFx1NzUxRlx1NjIxMFx1NTY2OFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1VVSURcdTc1MUZcdTYyMTBcdTU2NjgnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ3V1aWRcdTc1MUZcdTYyMTBcdTU2NjhcdUZGMENcdTYyNzlcdTkxQ0Z1dWlkXHU3NTFGXHU2MjEwJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvYmFycmFnZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0JhcnJhZ2UvQmFycmFnZS52dWUnKSxcclxuICAgIG5hbWU6ICdiYXJyYWdlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2MjRCXHU2MzAxXHU1RjM5XHU1RTU1XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2MjRCXHU2MzAxXHU1RjM5XHU1RTU1XHVGRjBDXHU1RjM5XHU1RTU1XHU1REU1XHU1MTc3JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTYyNEJcdTYzMDFcdTVGMzlcdTVFNTVcdTY2MkZcdTRFMDBcdTc5Q0RcdTY1QjBcdTU3OEJcdTc2ODRcdTRFOTJcdTUyQThcdTZDOUZcdTkwMUFcdTVERTVcdTUxNzdcdUZGMENcdTUzRUZcdTRFRTVcdTY1QjlcdTRGQkZcdTU3MzBcdTRFM0FcdTU0MDRcdTc5Q0RcdTYyMzdcdTU5MTZcdTZEM0JcdTUyQThcdTMwMDFcdTZGMTRcdTUxRkFcdTU2MDlcdTVFNzRcdTUzNEVcdTdCNDlcdTZEM0JcdTUyQThcdTU4OUVcdTUyQTBcdThEQTNcdTU0NzNcdTYwMjdcdTU0OENcdTRFOTJcdTUyQThcdTYwMjdcdTMwMDJcdTYyNEJcdTYzMDFcdTVGMzlcdTVFNTVcdTUxNzdcdTY3MDlcdThGN0JcdTRGQkZcdTMwMDFcdTY2MTNcdTY0M0FcdTVFMjZcdTMwMDFcdTY2MTNcdTY0Q0RcdTRGNUNcdTdCNDlcdTRGMThcdTcwQjlcdUZGMENcdTUzRUZcdTRFRTVcdThCQTlcdTZCQ0ZcdTRFMkFcdTUzQzJcdTRFMEVcdTgwMDVcdTkwRkRcdTUzRDhcdTYyMTBcdTZEM0JcdTUyQThcdTc2ODRcdTRFMDBcdTkwRThcdTUyMDZcdTMwMDJcdTU0MENcdTY1RjZcdUZGMENcdTYyNEJcdTYzMDFcdTVGMzlcdTVFNTVcdThGRDhcdTUzRUZcdTRFRTVcdTkwMUFcdThGQzdcdTk4ODRcdTUxNDhcdTdGMTZcdTUxOTlcdTc2ODRcdTY1ODdcdTY3MkNcdTMwMDFcdTg4NjhcdTYwQzVcdTdCNDlcdTVGNjJcdTVGMEZcdUZGMENcdTg4NjhcdThGQkVcdTUzQzJcdTRFMEVcdTgwMDVcdTc2ODRcdTYwQzVcdTYxMUZcdTU0OENcdTYwRjNcdTZDRDVcdUZGMENcdTVCOUVcdTczQjBcdTZDOUZcdTkwMUFcdTRFOTJcdTUyQThcdTMwMDJcdTU3MjhcdTc5M0VcdTRFQTRcdTVBOTJcdTRGNTNcdTY1RjZcdTRFRTNcdUZGMENcdTYyNEJcdTYzMDFcdTVGMzlcdTVFNTVcdTc2ODRcdTRGN0ZcdTc1MjhcdTRFNUZcdTVFMjZcdTY3NjVcdTRFODZcdTY2RjRcdTVFN0ZcdTZDREJcdTc2ODRcdTc5M0VcdTRFQTRcdTY1NDhcdTVFOTRcdUZGMENcdTU4OUVcdTUyQTBcdTRFODZcdTZEM0JcdTUyQThcdTc2ODRcdTRFOTJcdTUyQThcdTYwMjdcdTU0OENcdTRGMjBcdTY0QURcdTVFQTZcdTMwMDJcdTY1RTBcdThCQkFcdTY2MkZcdTRFM0VcdTUyOUVcdTY1QjlcdThGRDhcdTY2MkZcdTUzQzJcdTRFMEVcdTgwMDVcdUZGMENcdTYyNEJcdTYzMDFcdTVGMzlcdTVFNTVcdTkwRkRcdTY2MkZcdTRFMDBcdTRFMkFcdTk3NUVcdTVFMzhcdTY3MDlcdTRFRjdcdTUwM0NcdTc2ODRcdTRFOTJcdTUyQThcdTVERTVcdTUxNzdcdTMwMDInLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9wYWxldHRlcycsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1BhbGV0dGVzL1BhbGV0dGVzLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3BhbGV0dGVzJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU4MjcyXHU2NzdGXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU4MjcyXHU2NzdGXHVGRjBDXHU5ODlDXHU4MjcyXHU2NzdGJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZcdTU5MERcdTUyMzZcdTk4OUNcdTgyNzJcdUZGMENcdTU5N0RcdTc3MEJcdTc2ODRcdTk4OUNcdTgyNzJcdTdFQzRcdTU0MDhcdTgyNzJcdTY3N0YnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy91bml0JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvVW5pdC9Vbml0LnZ1ZScpLFxyXG4gICAgbmFtZTogJ3VuaXQnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTUzNTVcdTRGNERcdThGNkNcdTYzNjJcIixcclxuICAgICAga2V5d29yZHM6ICdcdTU3MjhcdTdFQkZcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTcsXHU5NTdGXHU1RUE2XHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1OTc2Mlx1NzlFRlx1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5NyxcdTY1RjZcdTk1RjRcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTcsXHU5MUNEXHU5MUNGXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1NkUyOVx1NUVBNlx1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5NyxcdTUzOEJcdTUyOUJcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTcsXHU3MEVEXHU5MUNGXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1NTI5Rlx1NzM4N1x1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5N1x1MzAwMicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1OTU3Rlx1NUVBNlx1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5NyxcdTk3NjJcdTc5RUZcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTcsXHU2NUY2XHU5NUY0XHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1OTFDRFx1OTFDRlx1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5NyxcdTZFMjlcdTVFQTZcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTcsXHU1MzhCXHU1MjlCXHU1MzU1XHU0RjREXHU2MzYyXHU3Qjk3LFx1NzBFRFx1OTFDRlx1NTM1NVx1NEY0RFx1NjM2Mlx1N0I5NyxcdTUyOUZcdTczODdcdTUzNTVcdTRGNERcdTYzNjJcdTdCOTdcdTMwMDInLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9xcmNvZGUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9RcmNvZGUvUXJjb2RlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3FyY29kZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NEU4Q1x1N0VGNFx1NzgwMVx1NzUxRlx1NjIxMFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NEU4Q1x1N0VGNFx1NzgwMSxxcmNvZGUsXHU0RThDXHU3RUY0XHU3ODAxXHU1MjM2XHU0RjVDLFx1NEU4Q1x1N0VGNFx1NzgwMVx1NzUxRlx1NjIxMCxcdTVGQUVcdTRGRTFcdTRFOENcdTdFRjRcdTc4MDEnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1NzUxRlx1NjIxMFx1NEU4Q1x1N0VGNFx1NzgwMSxcdTY1MkZcdTYzMDFsb2dvXHU0RThDXHU3RUY0XHU3ODAxLFx1NTkxQVx1NzlDRFx1NjgzN1x1NUYwRlx1OTg4NFx1OEJCRScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3FyY29kZS1zY2FuJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvUXJjb2RlU2Nhbi9RcmNvZGVTY2FuLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3FyY29kZVNjYW4nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTRFOENcdTdFRjRcdTc4MDFcdThCQzZcdTUyMkJcIixcclxuICAgICAga2V5d29yZHM6ICdcdTRFOENcdTdFRjRcdTc4MDFcdThCQzZcdTUyMkIsXHU0RThDXHU3RUY0XHU3ODAxXHU2MjZCXHU2M0NGLHFyY29kZVx1NjI2Qlx1NjNDRixcdTRFOENcdTdFRjRcdTc4MDFcdThCRkJcdTUzRDYnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1OEJDNlx1NTIyQlx1NEU4Q1x1N0VGNFx1NzgwMSxcdTY1MkZcdTYzMDFcdTY0NDRcdTUwQ0ZcdTU5MzRcdTYyNkJcdTYzQ0ZcdTMwMDFcdTU2RkVcdTcyNDdcdTRFMEFcdTRGMjBcdTMwMDFcdTYyRDZcdTYyRkRcdTdCNDlcdTU5MUFcdTc5Q0RcdTY1QjlcdTVGMEYnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9maWxlc2l6ZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0ZpbGVTaXplL0ZpbGVTaXplLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2ZpbGVTaXplJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2NTg3XHU0RUY2XHU1OTI3XHU1QzBGXHU4RjZDXHU2MzYyXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2NTg3XHU0RUY2XHU1OTI3XHU1QzBGXHU4RjZDXHU2MzYyLFx1NUI1N1x1ODI4Mlx1OEY2Q1x1NjM2MixLQlx1OEY2Q1x1NjM2MixNQlx1OEY2Q1x1NjM2MixHQlx1OEY2Q1x1NjM2MixUQlx1OEY2Q1x1NjM2MicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU2NTg3XHU0RUY2XHU1OTI3XHU1QzBGXHU1MzU1XHU0RjREXHU4RjZDXHU2MzYyXHU1REU1XHU1MTc3LFx1NjUyRlx1NjMwMVx1NUI1N1x1ODI4Mlx1MzAwMUtCXHUzMDAxTUJcdTMwMDFHQlx1MzAwMVRCXHU3QjQ5XHU1MzU1XHU0RjREXHU0RTkyXHU4RjZDJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvZGVjaXNpb24nLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9EZWNpc2lvbi9EZWNpc2lvbi52dWUnKSxcclxuICAgIG5hbWU6ICdkZWNpc2lvbicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NUUyRVx1NjIxMVx1NTFCM1x1NUI5QVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1OTAwOVx1NjJFOVx1NTZGMFx1OTZCRVx1RkYwQ1x1OTZCRVx1NEVFNVx1NTFCM1x1NUI5QVx1RkYwQ1x1NEVDQVx1NTkyOVx1NTQwM1x1NEVDMFx1NEU0OFx1RkYwQ1x1NzNCMFx1NTcyOFx1NTA1QVx1NEVDMFx1NEU0OFx1RkYwQ1x1ODFFQVx1NUI5QVx1NEU0OVx1OTAwOVx1OTg3OVx1OTBGRFx1N0VEOVx1NEY2MFx1NUI4OVx1NjM5Mlx1NzY4NFx1NjYwRVx1NjYwRVx1NzY3RFx1NzY3RCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU5MDA5XHU2MkU5XHU1NkYwXHU5NkJFXHU3NUM3XHVGRjBDXHU4MUVBXHU1QjlBXHU0RTQ5XHU5MDA5XHU2MkU5XHU1MTg1XHU1QkI5JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvbW9yc2UnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9Nb3JzZS9Nb3JzZS52dWUnKSxcclxuICAgIG5hbWU6ICdtb3JzZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjQ2OVx1NjVBRlx1NzUzNVx1NzgwMVwiLFxyXG4gICAgICBrZXl3b3JkczogJ21vcnNlXHU3NTM1XHU3ODAxLFx1NjQ2OVx1NjVBRlx1NzUzNVx1NzgwMScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2NDY5XHU2NUFGXHU3NTM1XHU3ODAxXHU3RjE2XHU3ODAxXHU4OUUzXHU3ODAxJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvcmFuZG9tJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvUmFuZG9tL1JhbmRvbS52dWUnKSxcclxuICAgIG5hbWU6ICdyYW5kb20nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTc1MUZcdTYyMTBcdTk2OEZcdTY3M0FcdTY1NzBcIixcclxuICAgICAga2V5d29yZHM6ICdcdTk2OEZcdTY3M0FcdTY1NzBcdTc1MUZcdTYyMTAsXHU5NjhGXHU2NzNBXHU2NTcwJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTUzRUZcdTVCOUFcdTUyMzZcdTgzMDNcdTU2RjRcdTUxODVcdThGREJcdTg4NENcdTk2OEZcdTY3M0FcdTY1NzBcdTVCNTdcdUZGMENcdTUzRUZcdTc1MjhcdTRFOEVcdTYyQkRcdTU5NTZcdTMwMDFcdTcwQjlcdTU0MERcdTdCNDlcdTc1MjhcdTkwMTQnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9udW1iZXJ0b2NoaW5lc2UnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9OdW1iZXJUb0NoaW5lc2UvTnVtYmVyVG9DaGluZXNlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ251bWJlclRvQ2hpbmVzZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjU3MFx1NUI1N1x1OEY2Q1x1OTFEMVx1OTg5RFx1NTkyN1x1NTE5OVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjU3MFx1NUI1N1x1OEY2Q1x1NEUyRFx1NjU4NyxcdTY1NzBcdTVCNTdcdThGNkNcdTU5MjdcdTUxOTksXHU0RTJEXHU2NTg3XHU4RjZDXHU2NTcwXHU1QjU3LFx1NTkyN1x1NTE5OVx1OEY2Q1x1NjU3MFx1NUI1NyxcdTY1NzBcdTVCNTdcdTRFMkRcdTY1ODdcdTRFOTJcdThGNkMnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1NjU3MFx1NUI1N1x1NEUwMFx1OTUyRVx1OEY2Q1x1NjM2Mlx1NjIxMFx1NEVCQVx1NkMxMVx1NUUwMVx1NTkyN1x1NTE5OVx1RkYwQ1x1NEUyRFx1NjU4N1x1NTkyN1x1NTE5OVx1OTFEMVx1OTg5RFx1NjU3MFx1NUI1N1x1NUU5NFx1NzUyOFx1NkI2M1x1Njk3N1x1NjIxNlx1ODg0Q1x1NEU2Nlx1NTg2Qlx1NTE5OScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2RpZmYnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9EaWZmL0RpZmYudnVlJyksXHJcbiAgICBuYW1lOiAnZGlmZicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjU4N1x1NjcyQ1x1NUJGOVx1NkJENFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NEUyRFx1NjU4N1x1NkJENFx1NUJGOSxcdTRFRTNcdTc4MDFcdTZCRDRcdTVCRjlcdUZGMENcdTRFRTNcdTc4MDFcdTVCRjlcdTZCRDRcdUZGMENcdTY1ODdcdTY3MkNcdTZCRDRcdTVCRjlcdUZGMENcdTgyRjFcdTY1ODdcdTZCRDRcdTVCRjknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NjU4N1x1NjcyQ1x1NURFRVx1NUYwMlx1NkJENFx1NUJGOVx1NjUyRlx1NjMwMVx1NEUyRFx1NjU4N1x1MzAwMVx1ODJGMVx1NjU4N1x1MzAwMVx1NEVFM1x1NzgwMVx1NkJENFx1NUJGOScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL21hcmtkb3duJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvTWFya2Rvd24vTWFya2Rvd24udnVlJyksXHJcbiAgICBuYW1lOiAnbWFya2Rvd24nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJtYXJrZG93blx1N0YxNlx1OEY5MVx1NTY2OFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NTcyOFx1N0VCRlx1NTIxQlx1NUVGQVx1NjIxNlx1N0YxNlx1OEY5MW1hcmtkb3duLCBcdTVCOUVcdTY1RjZcdTk4ODRcdTg5QzhcdUZGMENcdTVCRkNcdTUxRkFtYXJrZG93bicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGbWFya2Rvd25cdTdGMTZcdThGOTFcdTU2NjgnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy90ZXh0dG9pbWcnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9UZXh0VG9JbWcvVGV4dFRvSW1nLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3RleHRUb0ltZycsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjU4N1x1NjcyQ1x1OEY2Q1x1NTZGRVx1NzI0N1wiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjU4N1x1NjcyQ1x1NzUxRlx1NjIxMFx1NTZGRVx1NzI0N1x1RkYwQ1x1NjU4N1x1NjcyQ1x1NzUxRlx1NjIxMFx1OTU3Rlx1NTZGRVx1RkYwQ1x1NjNBOFx1NUU3Rlx1OTU3Rlx1NTZGRScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2MjhBXHU2NTg3XHU2NzJDXHU4RjZDXHU2MzYyXHU2MjEwXHU1NkZFXHU3MjQ3XHVGRjBDXHU3NTFGXHU2MjEwXHU5NTdGXHU1NkZFXHVGRjBDXHU1MTc3XHU2NzA5XHU4RDg1XHU1OTFBXHU0RTJBXHU2MDI3XHU2NTg3XHU1QjU3XHU2MzkyXHU3MjQ4JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvd2ViaW5mbycsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1dlYkluZm8vV2ViSW5mby52dWUnKSxcclxuICAgIG5hbWU6ICd3ZWJJbmZvJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU3RjUxXHU3QUQ5ZmF2aWNvblx1ODNCN1x1NTNENlwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1ODNCN1x1NTNENlx1N0Y1MVx1N0FEOWxvZ28sXHU4M0I3XHU1M0Q2XHU3RjUxXHU3QUQ5aWNvbixcdTgzQjdcdTUzRDZcdTdGNTFcdTdBRDlmYXZpY29uLFx1ODNCN1x1NTNENlx1N0Y1MVx1N0FEOVx1NjgwN1x1OTg5OCxcdTgzQjdcdTUzRDZcdTdGNTFcdTdBRDlcdTUxNzNcdTk1MkVcdThCQ0QsXHU4M0I3XHU1M0Q2XHU3RjUxXHU3QUQ5XHU2M0NGXHU4RkYwJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTgzQjdcdTUzRDZcdTdGNTFcdTdBRDlsb2dvXHUzMDAxaWNvblx1MzAwMWZhdmljb25cdTMwMDFcdTY4MDdcdTk4OThcdTMwMDFcdTUxNzNcdTk1MkVcdThCQ0RcdTMwMDFcdTYzQ0ZcdThGRjBcdTdCNDlcdTRGRTFcdTYwNkYnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9iYXInLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9DaGFydC9CYXIvQmFyLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2JhcicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjdGMVx1NzJCNlx1NTZGRVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjdGMVx1NzJCNlx1NTZGRScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU1MjM2XHU0RjVDXHU2N0YxXHU3MkI2XHU1NkZFXHVGRjBDXHU1MENGXHU1MDVBXHU4ODY4XHU2ODNDXHU0RTAwXHU2ODM3XHU1MjM2XHU0RjVDXHU1M0VGXHU4OUM2XHU1MzE2XHU1NkZFXHU4ODY4XHVGRjBDXHU2NTJGXHU2MzAxXHU1QkZDXHU1MUZBXHU5NzU5XHU2MDAxXHU2MjE2XHU1MkE4XHU2MDAxXHU1NkZFXHU4ODY4JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvbGluZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0NoYXJ0L0xpbmUvTGluZS52dWUnKSxcclxuICAgIG5hbWU6ICdsaW5lJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2Mjk4XHU3RUJGXHU1NkZFXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2Mjk4XHU3RUJGXHU1NkZFJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZcdTUyMzZcdTRGNUNcdTYyOThcdTdFQkZcdTU2RkVcdUZGMENcdTUwQ0ZcdTUwNUFcdTg4NjhcdTY4M0NcdTRFMDBcdTY4MzdcdTUyMzZcdTRGNUNcdTUzRUZcdTg5QzZcdTUzMTZcdTU2RkVcdTg4NjhcdUZGMENcdTY1MkZcdTYzMDFcdTVCRkNcdTUxRkFcdTk3NTlcdTYwMDFcdTYyMTZcdTUyQThcdTYwMDFcdTU2RkVcdTg4NjgnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9waWUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9DaGFydC9QaWUvUGllLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3BpZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1OTk3Q1x1NTZGRVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1OTk3Q1x1NTZGRScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU1MjM2XHU0RjVDXHU5OTdDXHU1NkZFXHVGRjBDXHU1MENGXHU1MDVBXHU4ODY4XHU2ODNDXHU0RTAwXHU2ODM3XHU1MjM2XHU0RjVDXHU1M0VGXHU4OUM2XHU1MzE2XHU1NkZFXHU4ODY4XHVGRjBDXHU2NTJGXHU2MzAxXHU1QkZDXHU1MUZBXHU5NzU5XHU2MDAxXHU2MjE2XHU1MkE4XHU2MDAxXHU1NkZFXHU4ODY4JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvc2NhdHRlcicsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0NoYXJ0L1NjYXR0ZXIvU2NhdHRlci52dWUnKSxcclxuICAgIG5hbWU6ICdzY2F0dGVyJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2NTYzXHU3MEI5XHU1NkZFXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2NTYzXHU3MEI5XHU1NkZFJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZcdTUyMzZcdTRGNUNcdTY1NjNcdTcwQjlcdTU2RkVcdUZGMENcdTUwQ0ZcdTUwNUFcdTg4NjhcdTY4M0NcdTRFMDBcdTY4MzdcdTUyMzZcdTRGNUNcdTUzRUZcdTg5QzZcdTUzMTZcdTU2RkVcdTg4NjhcdUZGMENcdTY1MkZcdTYzMDFcdTVCRkNcdTUxRkFcdTk3NTlcdTYwMDFcdTYyMTZcdTUyQThcdTYwMDFcdTU2RkVcdTg4NjgnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9jb2luJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQ29pbi9Db2luLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2NvaW4nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTYyOUJcdTc4NkNcdTVFMDFcIixcclxuICAgICAga2V5d29yZHM6ICdcdTYyOUJcdTc4NkNcdTVFMDEsXHU3ODZDXHU1RTAxJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTU3MjhcdTdFQkZcdTYyOUJcdTc4NkNcdTVFMDFcdUZGMENcdTkwMDlcdTYyRTlcdTU2RjBcdTk2QkVcdTkwQTNcdTRFNDhcdTRFQTRcdTdFRDlcdTc4NkNcdTVFMDFcdTY3NjVcdTVFMkVcdTRGNjBcdTkwMDlcdTYyRTlcdTU0MjcnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9kaWNlJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvRGljZS9EaWNlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2RpY2UnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTYyOTVcdTlBQjBcdTVCNTBcIixcclxuICAgICAga2V5d29yZHM6ICdcdTYyOTVcdTlBQjBcdTVCNTAsXHU5QUIwXHU1QjUwLFx1ODFFQVx1NUI5QVx1NEU0OVx1OUFCMFx1NUI1MCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1NzI4XHU3RUJGXHU2Mjk1XHU5QUIwXHU1QjUwXHVGRjBDXHU1M0VGXHU4MUVBXHU1QjlBXHU0RTQ5XHU5QUIwXHU1QjUwXHU2NTcwXHU5MUNGXHVGRjBDXHU3QjgwXHU1MzU1XHU1OTdEXHU3NTI4XHU3Njg0XHU5QUIwXHU1QjUwXHU1REU1XHU1MTc3JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvdGV4dHJlbW92ZWR1cGxpY2F0ZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1RleHRSZW1vdmVEdXBsaWNhdGUvVGV4dFJlbW92ZUR1cGxpY2F0ZS52dWUnKSxcclxuICAgIG5hbWU6ICd0ZXh0UmVtb3ZlRHVwbGljYXRlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2NTg3XHU2NzJDXHU1M0JCXHU5MUNEXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2NTg3XHU2NzJDXHU1M0JCXHU5MUNELFx1NjU4N1x1NjcyQ1x1NjM5Mlx1OTFDRFx1RkYwQ1x1NjU4N1x1NjcyQ1x1NTNCQlx1OTY2NFx1OTFDRFx1NTkwRCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU1M0VGXHU0RUU1XHU1MjIwXHU5NjY0XHU2MjE2XHU1M0JCXHU5NjY0XHU2NTg3XHU2NzJDXHU2MjE2XHU1QjU3XHU3QjI2XHU0RTMyXHU0RTJEXHU3Njg0XHU5MUNEXHU1OTBEXHU4ODRDJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvaW1nY3V0JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvSW1nQ3V0L0ltZ0N1dC52dWUnKSxcclxuICAgIG5hbWU6ICdpbWdDdXQnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTU2RkVcdTcyNDdcdTUyMDdcdTUyNzJcIixcclxuICAgICAga2V5d29yZHM6ICdcdTU2RkVcdTcyNDdcdTUyMDZcdTUyNzIsXHU1NkZFXHU3MjQ3XHU1MjA3XHU1MjcyLFx1NTZEQlx1NUJBQlx1NjgzQyxcdTRFNURcdTVCQUJcdTY4M0MsXHU1MzQxXHU1MTZEXHU1QkFCXHU2ODNDJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTVDMDZcdTU2RkVcdTcyNDdcdTUyMDZcdTUyNzJcdTYyMTBcdTU2REJcdTVCQUJcdTY4M0NcdTMwMDFcdTRFNURcdTVCQUJcdTY4M0NcdTMwMDFcdTUzNDFcdTUxNkRcdTVCQUJcdTY4M0NcdUZGMENcdTY1MkZcdTYzMDFcdTgxRUFcdTVCOUFcdTRFNDlcdTg4NENcdTRFMEVcdTUyMTcnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9odHRwc3RhdHVzY29kZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0h0dHBTdGF0dXNDb2RlL0h0dHBTdGF0dXNDb2RlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ0h0dHBTdGF0dXNDb2RlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiSFRUUFx1NzJCNlx1NjAwMVx1NzgwMVwiLFxyXG4gICAgICBrZXl3b3JkczogJ2h0dHBcdTcyQjZcdTYwMDFcdTc4MDEnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NjI0MFx1NjcwOWh0dHBcdTcyQjZcdTYwMDFcdTVCRjlcdTVFOTRcdTc2ODRcdTU0MERcdTc5RjBcdTU0OENcdTU0MkJcdTRFNDlcdTg5RTNcdTkxQ0EnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9qd3QnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9KV1QvSldULnZ1ZScpLFxyXG4gICAgbmFtZTogJ2p3dCcsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIkpXVFx1ODlFM1x1Njc5MFwiLFxyXG4gICAgICBrZXl3b3JkczogJ2p3dFx1ODlFM1x1Njc5MFx1RkYwQ2p3dFx1ODlFM1x1NzgwMVx1RkYwQ2pzb24gd2ViIHRva2VuJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTg5RTNcdTY3OTBcdTU0OENcdTg5RTNcdTc4MDFKU09OIFdlYiBUb2tlblx1RkYwOGp3dFx1RkYwOScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL25vdGVzJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvTm90ZXMvTm90ZXMudnVlJyksXHJcbiAgICBuYW1lOiAnbm90ZXMnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTdCMTRcdThCQjBcdTU5MDdcdTVGRDhcdTVGNTVcIixcclxuICAgICAga2V5d29yZHM6ICdcdTU3MjhcdTdFQkZcdTdCMTRcdThCQjAsXHU1OTA3XHU1RkQ4XHU1RjU1LFx1N0IxNFx1OEJCMFx1OEJCMFx1NUY1NSxcdTU3MjhcdTdFQkZcdThCQjBcdTRFOEJcdTY3MkMnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1N0IxNFx1OEJCMFx1OEJCMFx1NUY1NVx1NURFNVx1NTE3N1x1RkYwQ1x1NjUyRlx1NjMwMVx1NTIxQlx1NUVGQVx1MzAwMVx1N0YxNlx1OEY5MVx1MzAwMVx1NTIyMFx1OTY2NFx1N0IxNFx1OEJCMFx1RkYwQ1x1NjU3MFx1NjM2RVx1NUI4OVx1NTE2OFx1NUI1OFx1NTBBOCcsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2h0bWxlbnRpdHknLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9IdG1sRW50aXR5L0h0bWxFbnRpdHkudnVlJyksXHJcbiAgICBuYW1lOiAnSHRtbEVudGl0eScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcImh0bWxcdTVCOUVcdTRGNTNcdThGNkNcdTRFNDlcIixcclxuICAgICAga2V5d29yZHM6ICdodG1sXHU1QjlFXHU0RjUzXHU4RjZDXHU0RTQ5JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdodG1sXHU1QjlFXHU0RjUzXHU4RjZDXHU0RTQ5XHVGRjBDXHU1QjlFXHU0RjUzXHU4RjZDXHU0RTQ5XHU2MjEwaHRtbCcsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2NvbG9ycGlja2VyJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQ29sb3JQaWNrZXIvQ29sb3JQaWNrZXIudnVlJyksXHJcbiAgICBuYW1lOiAnQ29sb3JQaWNrZXInLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJDb2xvclx1OTAwOVx1NjJFOVx1NTY2OFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1OTg5Q1x1ODI3Mlx1OTAwOVx1NjJFOVx1NTY2OCxDb2xvclx1OTAwOVx1NjJFOVx1NTY2OCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU5ODlDXHU4MjcyXHU5MDA5XHU2MkU5XHU1NjY4XHUzMDAxXHU1NzI4XHU1NDA0XHU3OUNEXHU5ODlDXHU4MjcyXHU3QTdBXHU5NUY0XHU1OTgyXHU1MzQxXHU1MTZEXHU4RkRCXHU1MjM2XHUzMDAxcmdiXHUzMDAxaHNsXHUzMDAxY3NzXHU3QjQ5XHU3QjQ5XHU0RTRCXHU5NUY0XHU4RjZDXHU2MzYyXHU5ODlDXHU4MjcyJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvYXNjaWl3b3JkcGljJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQVNDSUlXb3JkUGljL0FTQ0lJV29yZFBpYy52dWUnKSxcclxuICAgIG5hbWU6ICdhc2NpaVdvcmRQaWMnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJBU0NJSVx1NUI1N1x1NUY2Mlx1NzUxRlx1NjIxMFx1NTY2OFwiLFxyXG4gICAgICBrZXl3b3JkczogJ0FTQ0lJXHU3NTNCLFx1NUI1N1x1NUY2Mlx1NzUzQixcdTVCNTdcdTVGNjJcdTc1MUZcdTYyMTBcdTU2NjgnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1NzUxRlx1NjIxMFx1NUI1N1x1NUY2MkFTQ0lJXHU3NTNCJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvaW1hZ2V0b2Jhc2U2NCcsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0ltYWdlVG9CYXNlNjQvSW1hZ2VUb0Jhc2U2NC52dWUnKSxcclxuICAgIG5hbWU6ICdpbWFnZVRvQmFzZTY0JyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU1NkZFXHU3MjQ3XHU4RjZDQmFzZTY0XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1NkZFXHU3MjQ3XHU4RjZDYmFzZTY0LFx1NTZGRVx1NzI0N1x1N0YxNlx1NzgwMSxiYXNlNjRcdTdGMTZcdTc4MDEsXHU1NkZFXHU3MjQ3XHU4RjZDXHU3ODAxJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTVDMDZcdTU2RkVcdTcyNDdcdTY1ODdcdTRFRjZcdThGNkNcdTYzNjJcdTRFM0FCYXNlNjRcdTdGMTZcdTc4MDFcdUZGMENcdTY1MkZcdTYzMDFcdTYyRDZcdTYyRkRcdTRFMEFcdTRGMjBcdTU0OENcdTcwQjlcdTUxRkJcdTRFMEFcdTRGMjBcdUZGMENcdTY1QjlcdTRGQkZcdTU3MjhcdTdGNTFcdTk4NzVcdTRFMkRcdTRGN0ZcdTc1MjhcdTU2RkVcdTcyNDcnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAgLy8ge1xyXG4gIC8vICAgcGF0aDogJy9qc2ZvcmFtdCcsXHJcbiAgLy8gICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0pTRm9ybWF0L0pTRm9ybWF0LnZ1ZScpLFxyXG4gIC8vICAgbmFtZTogJ0pTRm9yYW10JyxcclxuICAvLyAgIG1ldGE6IHtcclxuICAvLyAgICAgdGl0bGU6IFwianNcdTRFRTNcdTc4MDFcdTY4M0NcdTVGMEZcdTUzMTYvXHU1MzhCXHU3RjI5XCIsXHJcbiAgLy8gICAgIGtleXdvcmRzOiAnanNcdTRFRTNcdTc4MDFcdTY4M0NcdTVGMEZcdTUzMTYsanNcdTY4M0NcdTVGMEZcdTUzMTYsanNcdTUzOEJcdTdGMjksamF2YXNjcmlwdFx1NjgzQ1x1NUYwRlx1NTMxNicsXHJcbiAgLy8gICAgIGRlc2NyaXB0aW9uOiAnSlNcdTY4M0NcdTVGMEZcdTUzMTYvXHU1MzhCXHU3RjI5XHU1REU1XHU1MTc3LFx1NjNEMFx1NEY5Qlx1NTcyOFx1N0VCRkpTXHU2ODNDXHU1RjBGXHU1MzE2XHUzMDAxSlNcdTUzOEJcdTdGMjlcdTMwMDFKU1x1NkRGN1x1NkRDNlx1MzAwMUpTXHU4OUUzXHU1QkM2JyxcclxuICAvLyAgIH1cclxuICAvLyB9LFxyXG4gIC8vIHtcclxuICAvLyAgIHBhdGg6ICcvaHRtbGZvcm1hdCcsXHJcbiAgLy8gICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0h0bWxGb3JtYXQvSHRtbEZvcm1hdC52dWUnKSxcclxuICAvLyAgIG5hbWU6ICdIdG1sRm9ybWF0JyxcclxuICAvLyAgIG1ldGE6IHtcclxuICAvLyAgICAgdGl0bGU6IFwiaHRtbFx1NEVFM1x1NzgwMVx1NjgzQ1x1NUYwRlx1NTMxNlwiLFxyXG4gIC8vICAgICBrZXl3b3JkczogJ2h0bWxcdTY4M0NcdTVGMEZcdTUzMTYseG1sXHU2ODNDXHU1RjBGXHU1MzE2JyxcclxuICAvLyAgICAgZGVzY3JpcHRpb246ICdcdTYzRDBcdTRGOUJcdTU3MjhcdTdFQkZodG1sXHUzMDAxeG1sXHU2ODNDXHU1RjBGXHU1MzE2JyxcclxuICAvLyAgIH1cclxuICAvLyB9LFxyXG4gIC8vIHtcclxuICAvLyAgIHBhdGg6ICcvY3NzZm9ybWF0JyxcclxuICAvLyAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQ3NzRm9ybWF0L0Nzc0Zvcm1hdC52dWUnKSxcclxuICAvLyAgIG5hbWU6ICdDc3NGb3JtYXQnLFxyXG4gIC8vICAgbWV0YToge1xyXG4gIC8vICAgICB0aXRsZTogXCJjc3NcdTRFRTNcdTc4MDFcdTY4M0NcdTVGMEZcdTUzMTYvXHU1MzhCXHU3RjI5XCIsXHJcbiAgLy8gICAgIGtleXdvcmRzOiAnY3NzXHU2ODNDXHU1RjBGXHU1MzE2LGNzc1x1NTM4Qlx1N0YyOScsXHJcbiAgLy8gICAgIGRlc2NyaXB0aW9uOiAnXHU2M0QwXHU0RjlCXHU1NzI4XHU3RUJGY3NzXHU2ODNDXHU1RjBGXHU1MzE2LFx1NTcyOFx1N0VCRmNzc1x1NTM4Qlx1N0YyOVx1NURFNVx1NTE3NycsXHJcbiAgLy8gICB9XHJcbiAgLy8gfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3RleHRlZGl0JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvVGV4dEVkaXQvVGV4dEVkaXQudnVlJyksXHJcbiAgICBuYW1lOiAnVGV4dEVkaXQnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTU3MjhcdTdFQkZcdTY1ODdcdTY3MkNcdTdGMTZcdThGOTEvSFRNTFx1ODNCN1x1NTNENlwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjU4N1x1NjcyQ1x1N0YxNlx1OEY5MVx1RkYwQ1x1NUJDQ1x1NjU4N1x1NjcyQ1x1OTg4NFx1ODlDOFx1RkYwQ1x1NTcyOFx1N0VCRlx1N0YxNlx1OEY5MVx1NjU4N1x1NjcyQ1x1RkYwQ1x1NjU4N1x1NjcyQ1x1N0YxNlx1OEY5MVx1ODNCN1x1NTNENmh0bWwnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1NUJDQ1x1NjU4N1x1NjcyQ1x1N0YxNlx1OEY5MSwgaHRtbFx1NUI5RVx1NjVGNlx1OTg4NFx1ODlDOFx1RkYwQ1x1NTcyOFx1N0VCRlx1N0YxNlx1OEY5MVx1NjU4N1x1NjcyQ1x1RkYwQ1x1NjU4N1x1NjcyQ1x1N0YxNlx1OEY5MVx1ODNCN1x1NTNENmh0bWwnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9haS10ZXh0LXRvLWltYWdlJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlUZXh0VG9JbWFnZS9BaVRleHRUb0ltYWdlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ0FpVGV4dFRvSW1hZ2UnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTU3MjhcdTdFQkZcdTY1ODdcdTc1MUZcdTU2RkVcIixcclxuICAgICAga2V5d29yZHM6ICdcdTU3MjhcdTdFQkZcdTY1ODdcdTc1MUZcdTU2RkUsXHU2NTg3XHU3NTFGXHU1NkZFLFx1NjU4N1x1NzUxRlx1NTZGRVx1NURFNVx1NTE3NyxcdTY1ODdcdTc1MUZcdTU2RkVcdTY3MERcdTUyQTEnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NjNEMFx1NEY5Qlx1NTcyOFx1N0VCRlx1NTE0RFx1OEQzOVx1NjVFMFx1OTY1MFx1NkIyMVx1NjU3MFx1NzY4NFx1NjU4N1x1NzUxRlx1NTZGRVx1NjcwRFx1NTJBMScsXHJcbiAgICB9XHJcbiAgfSxcclxuICAvLyB7XHJcbiAgLy8gICBwYXRoOiAnL2FpLXRleHQtdG8tc3BlZWNoJyxcclxuICAvLyAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlUZXh0VG9TcGVlY2gvQWlUZXh0VG9TcGVlY2gudnVlJyksXHJcbiAgLy8gICBuYW1lOiAnQWlUZXh0VG9TcGVlY2gnLFxyXG4gIC8vICAgbWV0YToge1xyXG4gIC8vICAgICB0aXRsZTogXCJcdTU3MjhcdTdFQkZcdTY1ODdcdTY3MkNcdThGNkNcdThCRURcdTk3RjNcIixcclxuICAvLyAgICAga2V5d29yZHM6ICdcdTU3MjhcdTdFQkZcdTY1ODdcdTY3MkNcdThGNkNcdThCRURcdTk3RjMsXHU2NTg3XHU2NzJDXHU4RjZDXHU4QkVEXHU5N0YzLFx1OEJFRFx1OTdGM1x1NTQwOFx1NjIxMCxBSVx1OEJFRFx1OTdGMycsXHJcbiAgLy8gICAgIGRlc2NyaXB0aW9uOiAnXHU2M0QwXHU0RjlCXHU1NzI4XHU3RUJGXHU1MTREXHU4RDM5XHU2NUUwXHU5NjUwXHU2QjIxXHU2NTcwXHU3Njg0XHU2NTg3XHU2NzJDXHU4RjZDXHU4QkVEXHU5N0YzXHU2NzBEXHU1MkExJyxcclxuICAvLyAgIH1cclxuICAvLyB9LFxyXG4gIC8vIFx1NTE3M1x1NEU4RVxyXG4gIHtcclxuICAgIHBhdGg6ICcvYWJvdXQnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ib21lL0Fib3V0LnZ1ZScpLFxyXG4gICAgbmFtZTogJ2Fib3V0JyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU1MTczXHU0RThFXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1MTczXHU0RThFcmFuYmxvZ3MsXHU1MTczXHU0RThFXHU1REU1XHU1MTc3XHU3QUQ5JyxcclxuICAgICAgZGVzY3JpcHRpb246ICcnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAgLy8gXHU3NjdCXHU1RjU1XHU5ODc1XHU5NzYyXHJcbiAge1xyXG4gICAgcGF0aDogJy9sb2dpbicsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL0hvbWUvTG9naW4udnVlJyksXHJcbiAgICBuYW1lOiAnbG9naW4nLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTc1MjhcdTYyMzdcdTc2N0JcdTVGNTVcIixcclxuICAgICAga2V5d29yZHM6ICdcdTc1MjhcdTYyMzdcdTc2N0JcdTVGNTUsXHU4RDI2XHU1M0Y3XHU3NjdCXHU1RjU1LFx1NURFNVx1NTE3N1x1N0JCMVx1NzY3Qlx1NUY1NScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbHMtV2ViXHU1REU1XHU1MTc3XHU3QkIxXHU3NTI4XHU2MjM3XHU3NjdCXHU1RjU1XHU5ODc1XHU5NzYyXHVGRjBDXHU3NjdCXHU1RjU1XHU1NDBFXHU0RUFCXHU1M0Q3XHU2NkY0XHU1OTFBXHU0RTJBXHU2MDI3XHU1MzE2XHU1MjlGXHU4MEZEJyxcclxuICAgIH1cclxuICB9LFxyXG4gIC8vXHU1MTc2XHU0RUQ2XHU4REVGXHU3NTMxXHJcbiAge1xyXG4gICAgcGF0aDogJy80MDQnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy80MDQvNDA0LnZ1ZScpLFxyXG4gICAgbmFtZTogJzQwNCcsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIjQwNFwiXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICAvL1x1OTFDRFx1NUI5QVx1NTQxMVxyXG4gICAgcGF0aDogJy86cGF0aE1hdGNoKC4qKSonLFxyXG4gICAgcmVkaXJlY3Q6ICcvNDA0JyxcclxuICAgIG5hbWU6ICdBbnknLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9zbmFrZScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1NuYWtlL1NuYWtlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ3NuYWtlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU4RDJBXHU1NDAzXHU4NkM3XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU4RDJBXHU1NDAzXHU4NkM3LFx1NUMwRlx1NkUzOFx1NjIwRixcdTRGMTFcdTk1RjJcdTZFMzhcdTYyMEYsXHU5NTJFXHU3NkQ4XHU2RTM4XHU2MjBGJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTdFQ0ZcdTUxNzhcdThEMkFcdTU0MDNcdTg2QzdcdTZFMzhcdTYyMEZcdUZGMENcdTY1MkZcdTYzMDFcdTk1MkVcdTc2RDhcdTYzQTdcdTUyMzZcdUZGMENcdTYzMTFcdTYyMThcdTRGNjBcdTc2ODRcdTUzQ0RcdTVFOTRcdTkwMUZcdTVFQTYnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9tZW1vcnknLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9NZW1vcnkvTWVtb3J5LnZ1ZScpLFxyXG4gICAgbmFtZTogJ21lbW9yeScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1OEJCMFx1NUZDNlx1NTI5Qlx1N0ZGQlx1NzI0Q1wiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1OEJCMFx1NUZDNlx1NTI5Qlx1NkUzOFx1NjIwRixcdTdGRkJcdTcyNENcdTkxNERcdTVCRjksXHU4QkIwXHU1RkM2XHU4QkFEXHU3RUMzLFx1NzZDQVx1NjY3QVx1NkUzOFx1NjIwRicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU4QkIwXHU1RkM2XHU1MjlCXHU3RkZCXHU3MjRDXHU5MTREXHU1QkY5XHU2RTM4XHU2MjBGXHVGRjBDXHU4MDAzXHU5QThDXHU0RjYwXHU3Njg0XHU4QkIwXHU1RkM2XHU1MjlCXHVGRjBDXHU2MjdFXHU1MjMwXHU3NkY4XHU1NDBDXHU3Njg0XHU1MzYxXHU3MjQ3XHU5MTREXHU1QkY5XHVGRjBDXHU4QkFEXHU3RUMzXHU1OTI3XHU4MTExXHU4QkIwXHU1RkM2XHU4MEZEXHU1MjlCJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvdGV0cmlzJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvVGV0cmlzL1RldHJpcy52dWUnKSxcclxuICAgIG5hbWU6ICd0ZXRyaXMnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTRGQzRcdTdGNTdcdTY1QUZcdTY1QjlcdTU3NTdcIixcclxuICAgICAga2V5d29yZHM6ICdcdTRGQzRcdTdGNTdcdTY1QUZcdTY1QjlcdTU3NTcsXHU3NkNBXHU2NjdBXHU2RTM4XHU2MjBGLFx1N0E3QVx1OTVGNFx1NjAxRFx1N0VGNCxcdTdFQ0ZcdTUxNzhcdTZFMzhcdTYyMEYnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1N0VDRlx1NTE3OFx1NEZDNFx1N0Y1N1x1NjVBRlx1NjVCOVx1NTc1N1x1NkUzOFx1NjIwRlx1RkYwQ1x1ODAwM1x1OUE4Q1x1NEY2MFx1NzY4NFx1N0E3QVx1OTVGNFx1NjAxRFx1N0VGNFx1NTQ4Q1x1NTNDRFx1NUU5NFx1OTAxRlx1NUVBNlx1RkYwQ1x1NkQ4OFx1OTY2NFx1NkEyQVx1ODg0Q1x1ODNCN1x1NUY5N1x1OUFEOFx1NTIwNicsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3doYWNrYW1vbGUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9XaGFja0FNb2xlL1doYWNrQU1vbGUudnVlJyksXHJcbiAgICBuYW1lOiAnd2hhY2thbW9sZScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjI1M1x1NTczMFx1OUYyMFwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjI1M1x1NTczMFx1OUYyMCxcdTg4NTdcdTY3M0FcdTZFMzhcdTYyMEYsXHU1M0NEXHU1RTk0XHU5MDFGXHU1RUE2LFx1NjI0Qlx1NzczQ1x1NTM0Rlx1OEMwMycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU3RUNGXHU1MTc4XHU2MjUzXHU1NzMwXHU5RjIwXHU2RTM4XHU2MjBGXHVGRjBDXHU4MDAzXHU5QThDXHU0RjYwXHU3Njg0XHU1M0NEXHU1RTk0XHU5MDFGXHU1RUE2XHU1NDhDXHU2MjRCXHU3NzNDXHU1MzRGXHU4QzAzXHU4MEZEXHU1MjlCXHVGRjBDMzBcdTc5RDJcdTUwMTJcdThCQTFcdTY1RjZcdTYzMTFcdTYyMTgnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9nYW1lMjA0OCcsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0dhbWUyMDQ4L0dhbWUyMDQ4LnZ1ZScpLFxyXG4gICAgbmFtZTogJ2dhbWUyMDQ4JyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiMjA0OFwiLFxyXG4gICAgICBrZXl3b3JkczogJzIwNDgsXHU3NkNBXHU2NjdBXHU2RTM4XHU2MjBGLFx1NjU3MFx1NUI1N1x1OTAzQlx1OEY5MSxcdTdCNTZcdTc1NjVcdTYwMURcdTdFRjQnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1N0VDRlx1NTE3ODIwNDhcdTc2Q0FcdTY2N0FcdTZFMzhcdTYyMEZcdUZGMENcdTgwMDNcdTlBOENcdTRGNjBcdTc2ODRcdTdCNTZcdTc1NjVcdTYwMURcdTdFRjRcdTU0OENcdTY1NzBcdTVCNTdcdTkwM0JcdThGOTFcdTgwRkRcdTUyOUJcdUZGMENcdTkwMUFcdThGQzdcdTU0MDhcdTVFNzZcdThGQkVcdTUyMzAyMDQ4JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvbWluZXN3ZWVwZXInLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9NaW5lc3dlZXBlci9NaW5lc3dlZXBlci52dWUnKSxcclxuICAgIG5hbWU6ICdtaW5lc3dlZXBlcicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NjI2Qlx1OTZGN1wiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NjI2Qlx1OTZGNyxcdTkwM0JcdThGOTFcdTYzQThcdTc0MDYsXHU3NkNBXHU2NjdBXHU2RTM4XHU2MjBGLFx1NjU3MFx1NUI1N1x1NjNBOFx1NzQwNicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU3RUNGXHU1MTc4XHU2MjZCXHU5NkY3XHU2RTM4XHU2MjBGXHVGRjBDXHU4MDAzXHU5QThDXHU0RjYwXHU3Njg0XHU5MDNCXHU4RjkxXHU2M0E4XHU3NDA2XHU4MEZEXHU1MjlCXHVGRjBDXHU2MjdFXHU1MUZBXHU2MjQwXHU2NzA5XHU1NzMwXHU5NkY3XHU2MzExXHU2MjE4XHU2NzAwXHU1RkVCXHU2NUY2XHU5NUY0JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvcHV6emxlJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvUHV6emxlL1B1enpsZS52dWUnKSxcclxuICAgIG5hbWU6ICdwdXp6bGUnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJcdTY1NzBcdTVCNTdcdTUzNEVcdTVCQjlcdTkwNTNcIixcclxuICAgICAga2V5d29yZHM6ICdcdTY1NzBcdTVCNTdcdTUzNEVcdTVCQjlcdTkwNTMsXHU2RUQxXHU1NzU3XHU2RTM4XHU2MjBGLFx1NzZDQVx1NjY3QVx1NkUzOFx1NjIwRixcdTkwM0JcdThGOTFcdTZFMzhcdTYyMEYnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1N0VDRlx1NTE3OFx1NjU3MFx1NUI1N1x1NTM0RVx1NUJCOVx1OTA1M1x1NkUzOFx1NjIwRlx1RkYwQ1x1OTAxQVx1OEZDN1x1NzlGQlx1NTJBOFx1NjU3MFx1NUI1N1x1NjVCOVx1NTc1N1x1NUMwNlx1NjU3MFx1NUI1N1x1NjMwOVx1OTg3QVx1NUU4Rlx1NjM5Mlx1NTIxN1x1RkYwQ1x1ODAwM1x1OUE4Q1x1OTAzQlx1OEY5MVx1NjAxRFx1N0VGNFx1NTQ4Q1x1N0E3QVx1OTVGNFx1ODlDNFx1NTIxMlx1ODBGRFx1NTI5QicsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3N1ZG9rdScsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1N1ZG9rdS9TdWRva3UudnVlJyksXHJcbiAgICBuYW1lOiAnc3Vkb2t1JyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU2NTcwXHU3MkVDXHU2RTM4XHU2MjBGXCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU2NTcwXHU3MkVDLFx1NjU3MFx1NzJFQ1x1NkUzOFx1NjIwRixcdTU3MjhcdTdFQkZcdTY1NzBcdTcyRUMsXHU2NTcwXHU3MkVDXHU4OUUzXHU5ODk4JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTdFQ0ZcdTUxNzhcdTY1NzBcdTcyRUNcdTZFMzhcdTYyMEZcdUZGMENcdTgwMDNcdTlBOENcdTkwM0JcdThGOTFcdTYzQThcdTc0MDZcdTU0OENcdTY1NzBcdTVCNTdcdTUyMDZcdTY3OTBcdTgwRkRcdTUyOUInLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9haS1nb21va3UnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9BaUdvbW9rdS9BaUdvbW9rdS52dWUnKSxcclxuICAgIG5hbWU6ICdhaS1nb21va3UnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogXCJBSVx1NEU5NFx1NUI1MFx1NjhDQlwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NEU5NFx1NUI1MFx1NjhDQixBSVx1NEU5NFx1NUI1MFx1NjhDQixcdTU3MjhcdTdFQkZcdTRFOTRcdTVCNTBcdTY4Q0IsXHU2NjdBXHU4MEZEXHU0RTk0XHU1QjUwXHU2OENCJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTY2N0FcdTgwRkRcdTRFOTRcdTVCNTBcdTY4Q0JcdTZFMzhcdTYyMEZcdUZGMENcdTRFMEVBSVx1NUJGOVx1NjIxOFx1RkYwQ1x1ODAwM1x1OUE4Q1x1N0I1Nlx1NzU2NVx1NjAxRFx1N0VGNCcsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2FpaHViJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlIdWIvQWlIdWIudnVlJyksXHJcbiAgICBuYW1lOiAnYWlodWInLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogJ0FJXHU1REU1XHU1MTc3XHU1QkZDXHU4MjJBJyxcclxuICAgICAga2V5d29yZHM6ICdBSVx1NURFNVx1NTE3N1x1NUJGQ1x1ODIyQSxBSVx1NURFNVx1NTE3N1x1OTZDNlx1NTQwOCxBSVx1N0IyQ1x1NEUwOVx1NjVCOVx1NURFNVx1NTE3NyxBSVx1N0Y1MVx1N0FEOScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU3Q0JFXHU5MDA5XHU3QjJDXHU0RTA5XHU2NUI5QUlcdTVERTVcdTUxNzdcdTUyMDZcdTdDN0JcdTVCRkNcdTgyMkFcdUZGMENcdTRFMDBcdTk1MkVcdTc2RjRcdThGQkVcdTVFMzhcdTc1MjhBSVx1NjcwRFx1NTJBMVx1NEUwRVx1N0Y1MVx1N0FEOScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2FpLXZhcmlhYmxlLW5hbWUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9BaVZhcmlhYmxlTmFtZS9BaVZhcmlhYmxlTmFtZS52dWUnKSxcclxuICAgIG5hbWU6ICdhaS12YXJpYWJsZS1uYW1lJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6ICdBSVx1OEQ3N1x1NTNEOFx1OTFDRlx1NTQwRCcsXHJcbiAgICAgIGtleXdvcmRzOiAnQUlcdTUzRDhcdTkxQ0ZcdTU0MEQsQUlcdTUzRDhcdTkxQ0YsQUlcdTU0N0RcdTU0MEQsQUlcdThENzdcdTUzRDhcdTkxQ0ZcdTU0MEQnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NjgzOVx1NjM2RVx1NjNDRlx1OEZGMFx1ODFFQVx1NTJBOFx1NzUxRlx1NjIxMFx1N0IyNlx1NTQwOFx1NTQ3RFx1NTQwRFx1ODlDNFx1ODMwM1x1NzY4NFx1NTNEOFx1OTFDRlx1NTQwRFx1RkYwQ1x1NjUyRlx1NjMwMVx1NTkxQVx1NzlDRFx1NTQ3RFx1NTQwRFx1OThDRVx1NjgzQ1x1NEUwRVx1OEJFRFx1OEEwMCcsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2FpLW5hbWUnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9BaU5hbWUvQWlOYW1lLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2FpLW5hbWUnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogJ0FJXHU4RDc3XHU1NDBEJyxcclxuICAgICAga2V5d29yZHM6ICdBSVx1OEQ3N1x1NTQwRCxcdThENzdcdTU0MERcdTVCNTcsXHU1QjlEXHU1QjlEXHU4RDc3XHU1NDBELFx1NEUyRFx1NjU4N1x1NTlEM1x1NTQwRCxcdTUzRDZcdTU0MEQnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1OEY5M1x1NTE2NVx1NzIzNlx1NkJDRFx1NTlEM1x1NkMwRlx1RkYwQ1x1OTAwOVx1NjJFOVx1NTQwRFx1NzY4NFx1OTU3Rlx1NUVBNlx1NEUwRVx1NjAyN1x1NTIyQlx1RkYwQ1x1NzUxRlx1NjIxMFx1NTkxQVx1NEUyQVx1NEUyRFx1NjU4N1x1NTlEM1x1NTQwRFx1RkYwQ1x1NUU3Nlx1N0VEOVx1NTFGQVx1NTQ3RFx1NTQwRFx1NzQwNlx1NzUzMScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3Bvc3RtYW4nLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9Qb3N0bWFuTGl0ZS9Qb3N0bWFuTGl0ZS52dWUnKSxcclxuICAgIG5hbWU6ICdwb3N0bWFuJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiXHU1NzI4XHU3RUJGXHU4QkY3XHU2QzQyXHU4QzAzXHU4QkQ1XCIsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1NzI4XHU3RUJGcG9zdG1hbiwgaHR0cFx1NUJBMlx1NjIzN1x1N0FFRiwgXHU2M0E1XHU1M0UzXHU4QzAzXHU4QkQ1LCBcdThCRjdcdTZDNDJcdTY3ODRcdTkwMjAsIFx1OERFOFx1NTdERkNPUlMnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1N0I4MFx1NTMxNlx1NzI0OFBvc3RtYW5cdUZGMUFcdTY3ODRcdTkwMjBIVFRQXHU4QkY3XHU2QzQyXHUzMDAxXHU2N0U1XHU3NzBCXHU1NENEXHU1RTk0XHVGRjBDXHU2NTJGXHU2MzAxSlNPTlx1MzAwMVx1ODg2OFx1NTM1NVx1MzAwMVJhdycsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL3VybHBhcmFtcycsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL1VybFBhcmFtcy9VcmxQYXJhbXMudnVlJyksXHJcbiAgICBuYW1lOiAndXJsUGFyYW1zJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6ICdVUkwgXHU1M0MyXHU2NTcwXHU4OUUzXHU2NzkwL1x1Njc4NFx1OTAyMCcsXHJcbiAgICAgIGtleXdvcmRzOiAnVVJMIFx1NTNDMlx1NjU3MFx1ODlFM1x1Njc5MCxVUkwgXHU1M0MyXHU2NTcwXHU2Nzg0XHU5MDIwLHF1ZXJ5c3RyaW5nLFVSTCBcdTY3RTVcdThCRTJcdTUzQzJcdTY1NzAnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NEUwMFx1OTUyRVx1ODlFM1x1Njc5MCA/YT0xJmI9Mlx1RkYwQ1x1NjUyRlx1NjMwMVx1N0YxNlx1OEY5MVx1NTQwRVx1OTFDRFx1NjVCMFx1NjJGQ1x1NjNBNScsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL25hbWluZy1jYXNlJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvTmFtaW5nQ2FzZS9OYW1pbmdDYXNlLnZ1ZScpLFxyXG4gICAgbmFtZTogJ25hbWluZy1jYXNlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6ICdcdTU0N0RcdTU0MERcdTk4Q0VcdTY4M0NcdThGNkNcdTYzNjInLFxyXG4gICAgICBrZXl3b3JkczogJ3NuYWtlX2Nhc2UsY2FtZWxDYXNlLFBhc2NhbENhc2Usa2ViYWItY2FzZSxcdTU0N0RcdTU0MEQsXHU5OENFXHU2ODNDLFx1OEY2Q1x1NjM2MicsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnc25ha2VfY2FzZVx1MzAwMWNhbWVsQ2FzZVx1MzAwMVBhc2NhbENhc2VcdTMwMDFrZWJhYi1jYXNlIFx1NzZGOFx1NEU5Mlx1OEY2Q1x1NjM2Mlx1RkYwQ1x1NjUyRlx1NjMwMVx1OTAxMFx1ODg0Q1x1OEY2Q1x1NjM2Mlx1NEUwRVx1NTkwRFx1NTIzNicsXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2hhc2gnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9IYXNoL0hhc2gudnVlJyksXHJcbiAgICBuYW1lOiAnaGFzaCcsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiAnXHU1NEM4XHU1RTBDXHU2ODIxXHU5QThDL0hNQUMnLFxyXG4gICAgICBrZXl3b3JkczogJ1NIQTEsU0hBMjU2LFNIQTUxMixITUFDLVNIQTI1NixcdTU0QzhcdTVFMEMsXHU2NDU4XHU4OTgxLFx1NjgyMVx1OUE4QycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnU0hBLTEvMjU2LzUxMlx1MzAwMUhNQUMtU0hBMjU2XHVGRjBDXHU2NTJGXHU2MzAxXHU2NTg3XHU2NzJDXHU0RTBFXHU2NTg3XHU0RUY2XHU2NDU4XHU4OTgxXHU4QkExXHU3Qjk3JyxcclxuICAgIH1cclxuICB9LFxyXG4gIHtcclxuICAgIHBhdGg6ICcvYWktdHJhbnNsYXRlJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlUcmFuc2xhdGUvQWlUcmFuc2xhdGUudnVlJyksXHJcbiAgICBuYW1lOiAnYWktdHJhbnNsYXRlJyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6ICdBSVx1N0ZGQlx1OEJEMScsXHJcbiAgICAgIGtleXdvcmRzOiAnQUlcdTdGRkJcdThCRDEsXHU4MUVBXHU1MkE4XHU2OEMwXHU2RDRCLFx1NTkxQVx1OEJFRFx1OEEwMFx1N0ZGQlx1OEJEMSxMaWJyZVRyYW5zbGF0ZScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2NTJGXHU2MzAxXHU1OTFBXHU4QkVEXHU4QTAwXHU0RTkyXHU4QkQxXHVGRjBDXHU2RTkwXHU4QkVEXHU4QTAwXHU4MUVBXHU1MkE4XHU2OEMwXHU2RDRCXHVGRjBDXHU1MTREXHU4RDM5XHU0RjdGXHU3NTI4J1xyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9haS1lbGVtZW50YXJ5LWVzc2F5JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlFbGVtZW50YXJ5RXNzYXkvQWlFbGVtZW50YXJ5RXNzYXkudnVlJyksXHJcbiAgICBuYW1lOiAnYWktZWxlbWVudGFyeS1lc3NheScsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiAnQUlcdTVDMEZcdTVCNjZcdTRGNUNcdTY1ODcnLFxyXG4gICAgICBrZXl3b3JkczogJ0FJXHU1QzBGXHU1QjY2XHU0RjVDXHU2NTg3LFx1NEY1Q1x1NjU4N1x1NzUxRlx1NjIxMCxcdTVDMEZcdTVCNjZcdTc1MUZcdTRGNUNcdTY1ODcsXHU1RTc0XHU3RUE3XHU0RjVDXHU2NTg3LFx1OTg5OFx1Njc1MFx1NEY1Q1x1NjU4NycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2MzA5XHU1RTc0XHU3RUE3XHUzMDAxXHU0RjUzXHU4OEMxXHU1NDhDXHU1MTczXHU5NTJFXHU4QkNEXHU3NTFGXHU2MjEwXHU4RDM0XHU1NDA4XHU1QzBGXHU1QjY2XHU3NTFGXHU2QzM0XHU1RTczXHU3Njg0XHU0RjVDXHU2NTg3XHVGRjBDXHU2NTJGXHU2MzAxXHU1QjU3XHU2NTcwXHUzMDAxXHU5OENFXHU2ODNDXHU0RTBFXHU3RUQzXHU2Nzg0XHU2M0E3XHU1MjM2J1xyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9haS1kYWlseS1tb3RpdmF0aW9uJyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlEYWlseU1vdGl2YXRpb24vQWlEYWlseU1vdGl2YXRpb24udnVlJyksXHJcbiAgICBuYW1lOiAnYWktZGFpbHktbW90aXZhdGlvbicsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiAnQUlcdTZCQ0ZcdTY1RTVcdTUyQjFcdTVGRDdcdTlFMjFcdTZDNjRcdTY1ODcnLFxyXG4gICAgICBrZXl3b3JkczogJ0FJXHU5RTIxXHU2QzY0XHU2NTg3LFx1NTJCMVx1NUZEN1x1OUUyMVx1NkM2NFx1NjU4NyxcdTZCQ0ZcdTY1RTVcdTlFMjFcdTZDNjQsXHU2QjYzXHU4MEZEXHU5MUNGLFx1NTJCMVx1NUZEN1x1OEJFRFx1NUY1NScsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUlcdTY2N0FcdTgwRkRcdTc1MUZcdTYyMTBcdTZCQ0ZcdTY1RTVcdTUyQjFcdTVGRDdcdTlFMjFcdTZDNjRcdTY1ODdcdUZGMENcdTY1MkZcdTYzMDFcdTU5MUFcdTc5Q0RcdTk4Q0VcdTY4M0NcdTkwMDlcdTYyRTlcdUZGMENcdTVCOUFcdTY1RjZcdTUyMzdcdTY1QjBcdUZGMENcdTRFM0FcdTRGNjBcdTc2ODRcdTZCQ0ZcdTRFMDBcdTU5MjlcdTZDRThcdTUxNjVcdTZCNjNcdTgwRkRcdTkxQ0YnXHJcbiAgICB9XHJcbiAgfSxcclxuICB7XHJcbiAgICBwYXRoOiAnL2dvb2Qtc2l0ZXMnLFxyXG4gICAgY29tcG9uZW50OiAoKSA9PiBpbXBvcnQoJ0AvY29tcG9uZW50cy9Ub29scy9Hb29kU2l0ZXMvR29vZFNpdGVzLnZ1ZScpLFxyXG4gICAgbmFtZTogJ2dvb2Qtc2l0ZXMnLFxyXG4gICAgbWV0YToge1xyXG4gICAgICB0aXRsZTogJ1x1NTk3RFx1NzI2OVx1N0Y1MVx1N0FEOVx1NUJGQ1x1ODIyQScsXHJcbiAgICAgIGtleXdvcmRzOiAnXHU1OTdEXHU3MjY5XHU3RjUxXHU3QUQ5LFx1N0Y1MVx1N0FEOVx1NUJGQ1x1ODIyQSxcdTRGMThcdThEMjhcdTdGNTFcdTdBRDksXHU1QjlFXHU3NTI4XHU3RjUxXHU3QUQ5JyxcclxuICAgICAgZGVzY3JpcHRpb246ICdcdTdDQkVcdTkwMDlcdTRGMThcdThEMjhcdTdGNTFcdTdBRDlcdTUyMDZcdTdDN0JcdTVCRkNcdTgyMkFcdUZGMENcdTRFMDBcdTk1MkVcdTc2RjRcdThGQkVcdTVFMzhcdTc1MjhcdTY3MERcdTUyQTFcdTRFMEVcdTdGNTFcdTdBRDknLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9haS1jaGF0JyxcclxuICAgIGNvbXBvbmVudDogKCkgPT4gaW1wb3J0KCdAL2NvbXBvbmVudHMvVG9vbHMvQWlDaGF0L0FpQ2hhdC52dWUnKSxcclxuICAgIG5hbWU6ICdhaS1jaGF0JyxcclxuICAgIG1ldGE6IHtcclxuICAgICAgdGl0bGU6IFwiQUlcdTVCRjlcdThCRERcIixcclxuICAgICAga2V5d29yZHM6ICdBSVx1NUJGOVx1OEJERCxcdTY2N0FcdTgwRkRcdTVCRjlcdThCREQsQUlcdTUyQTlcdTYyNEIsXHU4MDRBXHU1OTI5XHU2NzNBXHU1NjY4XHU0RUJBLFx1NjY3QVx1ODBGRFx1OTVFRVx1N0I1NCcsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnXHU2NjdBXHU4MEZEQUlcdTVCRjlcdThCRERcdTUyQTlcdTYyNEJcdUZGMENcdTY1MkZcdTYzMDFcdTU5MUFcdThGNkVcdTVCRjlcdThCRERcdUZGMENcdTYzRDBcdTRGOUJcdTRFMTNcdTRFMUFcdTMwMDFcdTUxQzZcdTc4NkVcdTc2ODRcdTU2REVcdTdCNTRcdUZGMENcdTVFMkVcdTUyQTlcdTRGNjBcdTg5RTNcdTUxQjNcdTU0MDRcdTc5Q0RcdTk1RUVcdTk4OTgnLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAge1xyXG4gICAgcGF0aDogJy9pbWFnZS1jb21wcmVzcycsXHJcbiAgICBjb21wb25lbnQ6ICgpID0+IGltcG9ydCgnQC9jb21wb25lbnRzL1Rvb2xzL0ltYWdlQ29tcHJlc3MvSW1hZ2VDb21wcmVzcy52dWUnKSxcclxuICAgIG5hbWU6ICdpbWFnZS1jb21wcmVzcycsXHJcbiAgICBtZXRhOiB7XHJcbiAgICAgIHRpdGxlOiBcIlx1NTZGRVx1NzI0N1x1NTM4Qlx1N0YyOVwiLFxyXG4gICAgICBrZXl3b3JkczogJ1x1NTZGRVx1NzI0N1x1NTM4Qlx1N0YyOSxcdTU3MjhcdTdFQkZcdTUzOEJcdTdGMjksXHU1NkZFXHU3MjQ3XHU0RjE4XHU1MzE2LFx1NTM4Qlx1N0YyOVx1NTZGRVx1NzI0NyxcdTUxQ0ZcdTVDMEZcdTU2RkVcdTcyNDdcdTU5MjdcdTVDMEYnLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1x1NTcyOFx1N0VCRlx1NTZGRVx1NzI0N1x1NTM4Qlx1N0YyOVx1NURFNVx1NTE3N1x1RkYwQ1x1NjUyRlx1NjMwMUpQR1x1MzAwMVBOR1x1MzAwMVdlYlBcdTdCNDlcdTY4M0NcdTVGMEZcdUZGMENcdTUzRUZcdThDMDNcdTgyODJcdTUzOEJcdTdGMjlcdThEMjhcdTkxQ0ZcdUZGMENcdTY3MDlcdTY1NDhcdTUxQ0ZcdTVDMEZcdTU2RkVcdTcyNDdcdTY1ODdcdTRFRjZcdTU5MjdcdTVDMEZcdUZGMENcdTRGRERcdTYzMDFcdTU2RkVcdTcyNDdcdThEMjhcdTkxQ0YnLFxyXG4gICAgfVxyXG4gIH0sXHJcbl1cclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxkZXZcXFxcbm9kZWpzXFxcXHRvb2xzLXdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcZGV2XFxcXG5vZGVqc1xcXFx0b29scy13ZWJcXFxcc3NyLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovZGV2L25vZGVqcy90b29scy13ZWIvc3NyLmNvbmZpZy50c1wiO2ltcG9ydCB7Y29uc3RhbnRSb3V0ZX0gZnJvbSBcIi4vc3JjL3JvdXRlci9yb3V0ZXJcIlxyXG5pbXBvcnQgdml0ZVBsdWdpblNlb1ByZXJlbmRlciBmcm9tIFwidml0ZS1wbHVnaW4tc2VvLXByZXJlbmRlclwiO1xyXG5leHBvcnQgZnVuY3Rpb24gc2VvcGVyZW5kZXIoKXtcclxuICAgIC8vIFx1NjM5Mlx1OTY2NFx1NEUwRFx1OTAwMlx1NTQwOFx1OTg4NFx1NkUzMlx1NjdEM1x1NjIxNlx1NEYxQVx1ODlFNlx1NTNEMVx1N0Y1MVx1N0VEQy9cdTY3NDNcdTk2NTBcdTc2ODRcdThERUZcdTVGODRcclxuICAgIGNvbnN0IGZpbHRlclBhdGggPSBbXHJcbiAgICAgICAgJy86cGF0aE1hdGNoKC4qKSonLFxyXG4gICAgICAgICcvNDA0JyxcclxuICAgICAgICAvLyBcdTUyQThcdTYwMDFcdTVGM0FcdTdGNTFcdTdFRENcdTRGOURcdThENTZcdTYyMTZcdTk3MDBcdTg5ODFcdTY3NDNcdTk2NTAvXHU4QkJFXHU1OTA3XHU4MEZEXHU1MjlCXHJcbiAgICAgICAgJy9haS10ZXh0LXRvLWltYWdlJyxcclxuICAgICAgICAnL3FyY29kZS1zY2FuJyxcclxuICAgICAgICAnL3Bvc3RtYW4nLFxyXG4gICAgICAgICcvaXAnLFxyXG4gICAgICAgICcvd2ViaW5mbycsXHJcbiAgICBdO1xyXG4gICAgcmV0dXJuIHZpdGVQbHVnaW5TZW9QcmVyZW5kZXIoe1xyXG4gICAgICAgIHJvdXRlczogY29uc3RhbnRSb3V0ZVxyXG4gICAgICAgICAgICAuZmlsdGVyKHJvdXRlID0+ICEocm91dGUubWV0YSAmJiByb3V0ZS5tZXRhLnByZXJlbmRlciA9PT0gZmFsc2UpKVxyXG4gICAgICAgICAgICAubWFwKHJvdXRlQ29uZmlnID0+IHJvdXRlQ29uZmlnLnBhdGgpXHJcbiAgICAgICAgICAgIC5maWx0ZXIocGF0aCA9PiAhZmlsdGVyUGF0aC5pbmNsdWRlcyhwYXRoKSksXHJcbiAgICAgICAgbmV0d29yazoge1xyXG4gICAgICAgICAgICB0aW1lb3V0OiA0NTAwMCwgLy8gXHU5ODg0XHU2RTMyXHU2N0QzXHU3QjQ5XHU1Rjg1XHU4RDg1XHU2NUY2XHU2NUY2XHU5NUY0XHU2M0QwXHU1MzQ3XHU1MjMwNDVzXHJcbiAgICAgICAgICAgIC8vIHdhaXRGb3I6ICduZXR3b3JraWRsZTAnLCAvLyBcdTUzRUZcdTkwMDlcdUZGMUFcdTdCNDlcdTVGODVcdTdGNTFcdTdFRENcdTdBN0FcdTk1RjJcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbmN1cnJlbmN5OiAzLCAvLyBcdTVFNzZcdTUzRDFcdTk2NERcdTRGNEVcdUZGMENcdTUxQ0ZcdTVDMTFcdThENDRcdTZFOTBcdTdBREVcdTRFODlcclxuICAgICAgICBoZWFkbGVzczogdHJ1ZSxcclxuICAgICAgICAvLyByZW1vdmVTdHlsZTogdHJ1ZVxyXG4gICAgfSlcclxufSJdLAogICJtYXBwaW5ncyI6ICI7QUFBK1AsU0FBUyxjQUFjLGVBQWU7QUFDclMsT0FBTyxTQUFTO0FBQ2hCLFNBQVMsNEJBQTRCO0FBQ3JDLE9BQU8sVUFBVTs7O0FDRlYsSUFBTSxnQkFBZ0I7QUFBQTtBQUFBLEVBRTNCO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixXQUFXLE1BQU0sT0FBTyw0QkFBNEI7QUFBQSxJQUNwRCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsTUFDSixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBRUE7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLGdDQUFnQztBQUFBLElBQ3hELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sZ0NBQWdDO0FBQUEsSUFDeEQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sb0RBQW9EO0FBQUEsSUFDNUUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sNENBQTRDO0FBQUEsSUFDcEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sOEJBQThCO0FBQUEsSUFDdEQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sNENBQTRDO0FBQUEsSUFDcEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sNENBQTRDO0FBQUEsSUFDcEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0RBQXNEO0FBQUEsSUFDOUUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sNENBQTRDO0FBQUEsSUFDcEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sb0NBQW9DO0FBQUEsSUFDNUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0NBQWtDO0FBQUEsSUFDMUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0NBQWtDO0FBQUEsSUFDMUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0NBQXNDO0FBQUEsSUFDOUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sOENBQThDO0FBQUEsSUFDdEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sb0NBQW9DO0FBQUEsSUFDNUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0NBQXNDO0FBQUEsSUFDOUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0RBQXdEO0FBQUEsSUFDaEYsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0NBQWtDO0FBQUEsSUFDMUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMENBQTBDO0FBQUEsSUFDbEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sNENBQTRDO0FBQUEsSUFDcEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0NBQXNDO0FBQUEsSUFDOUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sd0NBQXdDO0FBQUEsSUFDaEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0NBQXNDO0FBQUEsSUFDOUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sOENBQThDO0FBQUEsSUFDdEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0NBQWtDO0FBQUEsSUFDMUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0NBQWtDO0FBQUEsSUFDMUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sZ0VBQWdFO0FBQUEsSUFDeEYsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0NBQXNDO0FBQUEsSUFDOUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sc0RBQXNEO0FBQUEsSUFDOUUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sZ0NBQWdDO0FBQUEsSUFDeEQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sb0NBQW9DO0FBQUEsSUFDNUQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sOENBQThDO0FBQUEsSUFDdEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sZ0RBQWdEO0FBQUEsSUFDeEUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sa0RBQWtEO0FBQUEsSUFDMUUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sb0RBQW9EO0FBQUEsSUFDNUUsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLElBQ2Y7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUErQkE7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDBDQUEwQztBQUFBLElBQ2xFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLG9EQUFvRDtBQUFBLElBQzVFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVlBO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixXQUFXLE1BQU0sT0FBTyw2QkFBNkI7QUFBQSxJQUNyRCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsTUFDSixPQUFPO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBRUE7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDZCQUE2QjtBQUFBLElBQ3JELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFFQTtBQUFBLElBQ0UsTUFBTTtBQUFBLElBQ04sV0FBVyxNQUFNLE9BQU8sMEJBQTBCO0FBQUEsSUFDbEQsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLE1BQ0osT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQUEsRUFDQTtBQUFBO0FBQUEsSUFFRSxNQUFNO0FBQUEsSUFDTixVQUFVO0FBQUEsSUFDVixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLG9DQUFvQztBQUFBLElBQzVELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDhDQUE4QztBQUFBLElBQ3RFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDBDQUEwQztBQUFBLElBQ2xFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLGdEQUFnRDtBQUFBLElBQ3hFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDBDQUEwQztBQUFBLElBQ2xFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLG9DQUFvQztBQUFBLElBQzVELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNEQUFzRDtBQUFBLElBQzlFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLGdEQUFnRDtBQUFBLElBQ3hFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDRDQUE0QztBQUFBLElBQ3BFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDhDQUE4QztBQUFBLElBQ3RFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLGtDQUFrQztBQUFBLElBQzFELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLGdEQUFnRDtBQUFBLElBQ3hFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDREQUE0RDtBQUFBLElBQ3BGLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDREQUE0RDtBQUFBLElBQ3BGLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLDRDQUE0QztBQUFBLElBQ3BFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLHNDQUFzQztBQUFBLElBQzlELE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUFBLEVBQ0E7QUFBQSxJQUNFLE1BQU07QUFBQSxJQUNOLFdBQVcsTUFBTSxPQUFPLG9EQUFvRDtBQUFBLElBQzVFLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRjtBQUNGOzs7QUM1d0JBLE9BQU8sNEJBQTRCO0FBQzVCLFNBQVMsY0FBYTtBQUV6QixRQUFNLGFBQWE7QUFBQSxJQUNmO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFFQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNKO0FBQ0EsU0FBTyx1QkFBdUI7QUFBQSxJQUMxQixRQUFRLGNBQ0gsT0FBTyxXQUFTLEVBQUUsTUFBTSxRQUFRLE1BQU0sS0FBSyxjQUFjLE1BQU0sRUFDL0QsSUFBSSxpQkFBZSxZQUFZLElBQUksRUFDbkMsT0FBTyxDQUFBQSxVQUFRLENBQUMsV0FBVyxTQUFTQSxLQUFJLENBQUM7QUFBQSxJQUM5QyxTQUFTO0FBQUEsTUFDTCxTQUFTO0FBQUE7QUFBQTtBQUFBLElBRWI7QUFBQSxJQUNBLGFBQWE7QUFBQTtBQUFBLElBQ2IsVUFBVTtBQUFBO0FBQUEsRUFFZCxDQUFDO0FBQ0w7OztBRjNCQSxJQUFNLG1DQUFtQztBQU96QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFDLFNBQVMsS0FBSSxNQUFNO0FBQy9DLE1BQUksTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLENBQUM7QUFDckMsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sd0JBQXdCLEtBQUssVUFBVSxZQUFZO0FBQUEsSUFDckQ7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLElBQUk7QUFBQSxNQUNKLHFCQUFxQjtBQUFBO0FBQUEsUUFFbkIsVUFBVSxDQUFDLEtBQUssUUFBUSxRQUFRLElBQUksR0FBRyxrQkFBa0IsQ0FBQztBQUFBO0FBQUEsUUFFMUQsVUFBVTtBQUFBLE1BQ1osQ0FBQztBQUFBLE1BQ0QsWUFBWTtBQUFBLElBQ2Q7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssS0FBSyxRQUFRLE9BQU87QUFBQTtBQUFBLFFBQ3pCLGVBQWUsS0FBSyxRQUFRLGtDQUFXLDJDQUEyQztBQUFBLE1BQ3BGO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sTUFBTSxJQUFJO0FBQUEsTUFDVixPQUFPO0FBQUEsUUFDTCxDQUFDLElBQUksaUJBQWlCLEdBQUk7QUFBQSxVQUN4QixRQUFRLElBQUk7QUFBQSxVQUNaLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFNaEI7QUFBQSxRQUNBLHFCQUFxQjtBQUFBLFVBQ25CLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFNBQVMsQ0FBQ0MsVUFBU0EsTUFBSyxRQUFRLHdCQUF3QixFQUFFO0FBQUEsVUFDMUQsU0FBUztBQUFBLFlBQ1AsZUFBZTtBQUFBLFVBQ2pCO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInBhdGgiLCAicGF0aCJdCn0K
