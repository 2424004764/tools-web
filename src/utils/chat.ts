// 公共聊天相关类型定义和工具函数

export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  reasoning?: string; // AI的思考过程
  timestamp: number;
  failed?: boolean;
  streaming?: boolean; // 标识是否正在流式输出
}

export interface ProviderSelection {
  provider: string;
  model: string;
}

// 生成唯一消息ID
let messageIdCounter = 0;
export const generateMessageId = () => {
  return `msg_${Date.now()}_${++messageIdCounter}`;
};

// 面试相关类型定义
export interface InterviewPrompt {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  template: string;
  inputs: InterviewInput[];
}

export interface InterviewInput {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string | number;
}

export interface InterviewConfig {
  promptId: string;
  inputs: Record<string, string | number>;
}

// 预定义的面试提示词
export const INTERVIEW_PROMPTS: InterviewPrompt[] = [
  {
    id: 'frontend-interview',
    name: '前端开发面试',
    description: '专业的前端开发技术面试，涵盖JavaScript、Vue、React等技术栈',
    category: '技术面试',
    icon: '💻',
    template: `你是一位资深的前端技术面试官，正在对候选人进行面试。

面试信息：
- 目标岗位：{position}
- 工作年限要求：{experience}年
- 技术栈：{techStack}
- 面试时长：约{duration}分钟

请按照以下要求进行面试：
1. 从基础问题开始，逐步深入
2. 根据候选人的回答调整问题难度
3. 注重实际项目经验和问题解决能力
4. 保持专业和友好的面试氛围
5. 在面试结束时给出综合评价和建议

现在请开始面试，先简单介绍一下这次面试的流程，然后提出第一个问题。`,
    inputs: [
      {
        key: 'position',
        label: '目标岗位',
        type: 'text',
        placeholder: '如：高级前端开发工程师',
        required: true
      },
      {
        key: 'experience',
        label: '工作年限要求',
        type: 'select',
        required: true,
        options: [
          { label: '1-2年', value: '1-2' },
          { label: '3-5年', value: '3-5' },
          { label: '5-8年', value: '5-8' },
          { label: '8年以上', value: '8+' }
        ]
      },
      {
        key: 'techStack',
        label: '技术栈',
        type: 'text',
        placeholder: '如：Vue3、TypeScript、Node.js',
        required: true
      },
      {
        key: 'duration',
        label: '面试时长（分钟）',
        type: 'select',
        required: true,
        options: [
          { label: '30分钟', value: '30' },
          { label: '45分钟', value: '45' },
          { label: '60分钟', value: '60' },
          { label: '90分钟', value: '90' }
        ]
      }
    ]
  },
  {
    id: 'backend-interview',
    name: '后端开发面试',
    description: '专业的后端开发技术面试，涵盖Java、Python、数据库等技术',
    category: '技术面试',
    icon: '⚙️',
    template: `你是一位资深的后端技术面试官，正在对候选人进行面试。

面试信息：
- 目标岗位：{position}
- 工作年限要求：{experience}年
- 技术栈：{techStack}
- 面试时长：约{duration}分钟

请按照以下要求进行面试：
1. 从基础问题开始，逐步深入
2. 重点考察系统设计、数据库设计、性能优化等核心能力
3. 根据候选人的回答调整问题难度
4. 注重实际项目经验和问题解决能力
5. 保持专业和友好的面试氛围
6. 在面试结束时给出综合评价和建议

现在请开始面试，先简单介绍一下这次面试的流程，然后提出第一个问题。`,
    inputs: [
      {
        key: 'position',
        label: '目标岗位',
        type: 'text',
        placeholder: '如：高级Java开发工程师',
        required: true
      },
      {
        key: 'experience',
        label: '工作年限要求',
        type: 'select',
        required: true,
        options: [
          { label: '1-2年', value: '1-2' },
          { label: '3-5年', value: '3-5' },
          { label: '5-8年', value: '5-8' },
          { label: '8年以上', value: '8+' }
        ]
      },
      {
        key: 'techStack',
        label: '技术栈',
        type: 'text',
        placeholder: '如：Java、Spring Boot、MySQL、Redis',
        required: true
      },
      {
        key: 'duration',
        label: '面试时长（分钟）',
        type: 'select',
        required: true,
        options: [
          { label: '30分钟', value: '30' },
          { label: '45分钟', value: '45' },
          { label: '60分钟', value: '60' },
          { label: '90分钟', value: '90' }
        ]
      }
    ]
  },
  {
    id: 'product-manager-interview',
    name: '产品经理面试',
    description: '产品经理岗位面试，考察产品思维、用户体验、项目管理等能力',
    category: '职能面试',
    icon: '📱',
    template: `你是一位资深的产品总监，正在对产品经理候选人进行面试。

面试信息：
- 目标岗位：{position}
- 工作年限要求：{experience}年
- 产品领域：{productField}
- 面试时长：约{duration}分钟

请按照以下要求进行面试：
1. 考察产品思维和用户理解能力
2. 重点关注项目管理和跨部门协作经验
3. 通过案例分析考察问题解决能力
4. 评估对行业趋势和竞品的了解程度
5. 保持友好的面试氛围，鼓励深入思考
6. 在面试结束时给出综合评价和发展建议

现在请开始面试，先简单介绍一下这次面试的流程，然后提出第一个问题。`,
    inputs: [
      {
        key: 'position',
        label: '目标岗位',
        type: 'text',
        placeholder: '如：高级产品经理',
        required: true
      },
      {
        key: 'experience',
        label: '工作年限要求',
        type: 'select',
        required: true,
        options: [
          { label: '1-3年', value: '1-3' },
          { label: '3-5年', value: '3-5' },
          { label: '5-8年', value: '5-8' },
          { label: '8年以上', value: '8+' }
        ]
      },
      {
        key: 'productField',
        label: '产品领域',
        type: 'select',
        required: true,
        options: [
          { label: '移动互联网', value: '移动互联网' },
          { label: '电商平台', value: '电商平台' },
          { label: '企业服务', value: '企业服务' },
          { label: '金融科技', value: '金融科技' },
          { label: '教育科技', value: '教育科技' },
          { label: '医疗健康', value: '医疗健康' },
          { label: '其他', value: '其他' }
        ]
      },
      {
        key: 'duration',
        label: '面试时长（分钟）',
        type: 'select',
        required: true,
        options: [
          { label: '45分钟', value: '45' },
          { label: '60分钟', value: '60' },
          { label: '90分钟', value: '90' }
        ]
      }
    ]
  },
  {
    id: 'hr-interview',
    name: 'HR面试/综合面试',
    description: '人力资源面试，考察综合素质、团队协作、职业规划等',
    category: '综合面试',
    icon: '👥',
    template: `你是一位经验丰富的HR经理，正在对候选人进行综合面试。

面试信息：
- 目标岗位：{position}
- 团队规模：{teamSize}
- 公司阶段：{companyStage}
- 面试时长：约{duration}分钟

请按照以下要求进行面试：
1. 了解候选人的基本情况和职业经历
2. 考察团队协作能力和沟通表达能力
3. 探讨职业规划和发展目标
4. 评估文化匹配度和价值观认同
5. 了解期望薪资和入职时间
6. 保持轻松友好的面试氛围
7. 在面试结束时介绍公司情况和后续流程

现在请开始面试，先简单介绍一下公司和这次面试的流程，然后提出第一个问题。`,
    inputs: [
      {
        key: 'position',
        label: '目标岗位',
        type: 'text',
        placeholder: '如：高级产品经理',
        required: true
      },
      {
        key: 'teamSize',
        label: '团队规模',
        type: 'select',
        required: true,
        options: [
          { label: '5-10人', value: '5-10人' },
          { label: '10-20人', value: '10-20人' },
          { label: '20-50人', value: '20-50人' },
          { label: '50-100人', value: '50-100人' },
          { label: '100人以上', value: '100人以上' }
        ]
      },
      {
        key: 'companyStage',
        label: '公司阶段',
        type: 'select',
        required: true,
        options: [
          { label: '初创公司', value: '初创公司' },
          { label: '成长期公司', value: '成长期公司' },
          { label: '成熟期公司', value: '成熟期公司' },
          { label: '大型企业', value: '大型企业' }
        ]
      },
      {
        key: 'duration',
        label: '面试时长（分钟）',
        type: 'select',
        required: true,
        options: [
          { label: '30分钟', value: '30' },
          { label: '45分钟', value: '45' },
          { label: '60分钟', value: '60' }
        ]
      }
    ]
  },
  {
    id: 'sales-interview',
    name: '销售岗位面试',
    description: '销售岗位面试，考察销售能力、沟通技巧、客户关系管理等',
    category: '职能面试',
    icon: '💼',
    template: `你是一位资深的销售总监，正在对销售岗位候选人进行面试。

面试信息：
- 目标岗位：{position}
- 销售产品：{product}
- 目标客户：{targetCustomer}
- 面试时长：约{duration}分钟

请按照以下要求进行面试：
1. 了解销售经验和业绩表现
2. 考察沟通能力和说服技巧
3. 评估客户关系管理能力
4. 测试抗压能力和应变能力
5. 了解对销售流程的理解
6. 通过角色扮演考察实际销售技能
7. 在面试结束时给出评价和建议

现在请开始面试，先简单介绍一下这次面试的流程，然后提出第一个问题。`,
    inputs: [
      {
        key: 'position',
        label: '目标岗位',
        type: 'text',
        placeholder: '如：高级销售经理',
        required: true
      },
      {
        key: 'product',
        label: '销售产品',
        type: 'text',
        placeholder: '如：企业软件解决方案',
        required: true
      },
      {
        key: 'targetCustomer',
        label: '目标客户',
        type: 'select',
        required: true,
        options: [
          { label: '个人消费者(B2C)', value: '个人消费者(B2C)' },
          { label: '中小企业(SMB)', value: '中小企业(SMB)' },
          { label: '大型企业(Enterprise)', value: '大型企业(Enterprise)' },
          { label: '政府客户(B2G)', value: '政府客户(B2G)' }
        ]
      },
      {
        key: 'duration',
        label: '面试时长（分钟）',
        type: 'select',
        required: true,
        options: [
          { label: '30分钟', value: '30' },
          { label: '45分钟', value: '45' },
          { label: '60分钟', value: '60' }
        ]
      }
    ]
  }
];

// 生成面试提示词
export const generateInterviewPrompt = (config: InterviewConfig): string => {
  const prompt = INTERVIEW_PROMPTS.find(p => p.id === config.promptId);
  if (!prompt) {
    throw new Error('未找到对应的面试提示词');
  }

  let template = prompt.template;
  
  // 替换模板中的变量
  Object.entries(config.inputs).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    template = template.replace(new RegExp(placeholder, 'g'), String(value));
  });

  return template;
};
