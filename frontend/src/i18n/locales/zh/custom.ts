export default {
  common: {
    apply: '应用',
    clear: '清除',
    creating: '创建中...',
    required: '必填',
    sending: '发送中...',
    tryAgain: '请重试',
  },
  home: {
    landing: {
      nav: {
        recharge: '充值',
      },
      actions: {
        rechargeNow: '立即充值',
        openWorkspace: '打开工作台',
        rechargeEntry: '充值入口',
      },
      workflowTitle: '让 API 中转成为清晰的日常工作流。',
      modelsTitle: '一个 Key，连接主流 AI 能力。',
      accessTitle: '从充值到调用，路径保持简单。',
      accessDescription:
        '充值后在控制台创建 API Key，将客户端 Base URL 指向 z30.top 的兼容接口，即可沿用原有 OpenAI SDK 的调用方式。',
      metrics: {
        gateway: '多账号容灾',
        billing: '额度可见',
        baseUrl: '兼容 OpenAI',
      },
      providerCaptions: {
        claude: 'messages API',
        gpt: '兼容 OpenAI',
        gemini: '支持 v1beta',
        antigravity: '专用路由',
        more: '可扩展上游',
      },
      providerStatus: {
        ready: '可用',
      },
      sections: {
        overview: '概览',
        quickActions: '快捷操作',
        status: '状态',
        compatibility: '兼容性',
        accessSteps: '接入步骤',
      },
      accessSteps: {
        connect: {
          title: '完成充值',
          description: '先通过充值入口补充余额，再开始调用网关。',
        },
        key: {
          title: '创建 API Key',
          description: '在控制台创建项目专用密钥，并保持最小权限范围。',
        },
        client: {
          title: '配置客户端',
          description: '将 Base URL 指向 https://z30.top/v1，沿用原有 SDK 流程。',
        },
      },
    },
  },
  nav: {
    tickets: '工单',
    ticketAdmin: '工单后台',
  },
  notifications: {
    announcementReply: '新的公告回复：{title}',
    ticketReply: '新的工单回复：{title}',
    replySectionTitle: '回复提醒',
    markRepliesRead: '将回复标记为已读',
  },
  announcements: {
    comments: {
      title: '评论',
      empty: '暂无评论',
      admin: '管理员',
      user: '用户',
      reply: '回复',
      replyingTo: '回复 {name}',
      placeholder: '写下评论...',
      send: '发送',
      sending: '发送中...',
      loadFailed: '加载评论失败',
      sendFailed: '发送评论失败',
      deleted: '评论已删除',
      deleteFailed: '删除评论失败',
    },
  },
  tickets: {
    create: '新建工单',
    view: '查看',
    close: '关闭工单',
    closeConfirm: '确定要关闭此工单吗？',
    detailTitle: '工单详情',
    selectHint: '从列表中选择一个工单',
    emptyDetail: '尚未选择工单',
    replyPlaceholder: '输入回复...',
    sendReply: '发送回复',
    sending: '发送中...',
    loadFailed: '加载工单失败',
    detailLoadFailed: '加载工单详情失败',
    created: '工单已创建',
    createFailed: '创建工单失败',
    replyFailed: '发送回复失败',
    closed: '工单已关闭',
    closeFailed: '关闭工单失败',
    form: {
      title: '标题',
      content: '内容',
    },
    status: {
      all: '全部状态',
      open: '开启',
      closed: '已关闭',
    },
    columns: {
      title: '标题',
      status: '状态',
      lastReply: '最后回复',
      actions: '操作',
    },
    sender: {
      admin: '管理员',
      user: '我',
    },
  },
  admin: {
    accounts: {
      fromModel: '原模型',
      toModel: '目标模型',
      messages: {
        accountCreated: '账号创建成功',
      },
      oauth: {
        openai: {
          accessTokenAuth: '手动输入 Access Token',
          mobileRefreshTokenAuth: '手动输入 Mobile Refresh Token',
        },
      },
      openai: {
        codexImageGenerationBridge: 'Codex 图片生成桥接',
        codexImageGenerationBridgeDesc:
          '账号级策略优先于渠道和全局配置。仅控制 Codex 通过 /responses 文本端点时是否注入 image_generation 工具；不影响独立图片生成接口。',
        codexImageGenerationBridgeInherit: '跟随渠道',
        codexImageGenerationBridgeInheritDesc: '不设置账号覆盖，继续使用渠道或全局策略。',
        codexImageGenerationBridgeEnabled: '强制开启',
        codexImageGenerationBridgeEnabledDesc: '允许 Codex /responses 请求获得图片工具注入。',
        codexImageGenerationBridgeDisabled: '强制关闭',
        codexImageGenerationBridgeDisabledDesc: '阻止 Codex /responses 注入图片工具。',
        codexImageGenerationBridgeBadgeEnabled: '账号开启',
        codexImageGenerationBridgeBadgeDisabled: '账号关闭',
        codexImageGenerationBridgeBadgeInherit: '渠道策略',
      },
    },
    announcements: {
      comments: {
        enabled: '评论已开启',
        disabled: '评论已关闭',
      },
      form: {
        commentsEnabled: '开启评论',
        commentsEnabledHint: '允许用户和管理员评论并回复此公告',
      },
    },
    channels: {
      emptyModelsInPricing: '暂无定价模型',
      noGroupsSelected: '未选择分组',
    },
    users: {
      passwordCopied: '密码已复制',
    },
    ops: {
      runtime: {
        metricThresholds: '指标阈值配置',
        metricThresholdsHint: '配置各项指标的告警阈值，超过阈值时以红色显示',
        slaMinPercent: 'SLA 最低百分比',
        slaMinPercentHint: 'SLA 低于此值时显示为红色（默认：99.5%）',
        ttftP99MaxMs: 'TTFT P99 上限（毫秒）',
        ttftP99MaxMsHint: 'TTFT P99 超过此值时显示为红色',
        requestErrorRateMaxPercent: '请求错误率上限',
        requestErrorRateMaxPercentHint: '请求错误率超过此值时显示为红色',
        upstreamErrorRateMaxPercent: '上游错误率上限',
        upstreamErrorRateMaxPercentHint: '上游错误率超过此值时显示为红色',
      },
    },
    settings: {
      features: {
        tickets: {
          title: '工单系统',
          description: '允许用户提交支持工单，管理员可以回复或关闭工单。默认关闭。',
          configureLink: '前往工单后台',
          enabled: '启用工单系统',
          enabledHint: '关闭后会隐藏工单菜单，工单 API 也会拒绝请求。',
        },
      },
    },
    tickets: {
      searchPlaceholder: '搜索标题、邮箱、用户名或用户 ID...',
      view: '查看',
      close: '关闭工单',
      closeConfirm: '确定要关闭此工单吗？',
      detailTitle: '工单详情',
      selectHint: '从列表中选择一个工单',
      emptyDetail: '尚未选择工单',
      replyPlaceholder: '输入管理员回复...',
      sendReply: '发送回复',
      sending: '发送中...',
      loadFailed: '加载工单失败',
      detailLoadFailed: '加载工单详情失败',
      replyFailed: '发送回复失败',
      closed: '工单已关闭',
      closeFailed: '关闭工单失败',
      userId: '用户 #{id}',
      status: {
        all: '全部状态',
        open: '开启',
        closed: '已关闭',
      },
      columns: {
        title: '标题',
        user: '用户',
        status: '状态',
        lastReply: '最后回复',
        actions: '操作',
      },
      sender: {
        admin: '管理员',
        user: '用户',
      },
    },
  },
}
