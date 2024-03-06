# 功能说明

定时备份工具，备份到阿里云 oss

1. 可以指定目录 或者 文件进行备份，可以同时指定多条
2. 使用 cron 表达式指定备份的周期
3. 只保存最近 x 条备份记录，支持通过配置的方式更改
4. 配置信息通过 yaml 读取

# 使用方式

1. clone 此仓库
2. 复制 `config.example.yaml` 为 `config.yaml`,按需替换里面的内容
3. `pm2 start main.js --name "oss-backup-service"` 即可