App<IAppOption>({
  globalData: {
    token: ''
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    this.globalData.token = token || '';
  }
});
