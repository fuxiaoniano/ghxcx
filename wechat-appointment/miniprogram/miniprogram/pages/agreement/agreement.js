"use strict";
Page({ data: { type: 'privacy', title: '隐私协议' }, onLoad(options) { const type = options.type === 'user' ? 'user' : 'privacy'; const title = type === 'user' ? '用户协议' : '隐私协议'; this.setData({ type, title }); wx.setNavigationBarTitle({ title }); } });
