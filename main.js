const OSS = require("ali-oss");
const cron = require("node-cron");
const yaml = require("yamljs");
const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const dayjs = require("dayjs");

// 读取配置文件
const config = yaml.load(path.join(process.cwd(), "config.yaml"));

// 创建OSS客户端
const client = new OSS({
  region: config.oss.region,
  accessKeyId: config.oss.accessKeyId,
  accessKeySecret: config.oss.accessKeySecret,
  bucket: config.oss.bucket,
});

async function uploadToOSS(filePath, backupName) {
  try {
    await client.put(backupName, filePath);
    console.log(`Uploaded ${filePath} as ${backupName}`);
  } catch (error) {
    console.error(`Error uploading ${filePath}: ${error}`);
  }
}

async function backupItem(item) {
  const backupTime = dayjs().format("YYYY-MM-DD-HH-mm-ss");
  const baseBackupPath = `${item.key}/${backupTime}`;

  const stats = await fs.stat(item.path);
  if (stats.isDirectory()) {
    const files = glob.sync("**/*", {
      cwd: item.path,
      nodir: true,
      absolute: true,
    });
    for (const file of files) {
      const relativePath = path.relative(item.path, file);
      const backupName = `${baseBackupPath}/${relativePath.replace(
        /\\/g,
        "/"
      )}`;
      await uploadToOSS(file, backupName);
    }
  } else {
    const fileName = path.basename(item.path);
    const backupName = `${baseBackupPath}/${fileName}`;
    await uploadToOSS(item.path, backupName);
  }

  // 清理旧的备份记录
  await cleanupOldBackups(item.key, item.keep);
}

async function cleanupOldBackups(key, keep) {
  try {
    let result = await client.list({
      prefix: key + "/",
      delimiter: "/",
      "max-keys": 1000,
    });
    let directories = result.prefixes;

    if (directories.length > keep) {
      directories.sort(); // 确保顺序，通常会按时间排序
      let dirsToDelete = directories.slice(0, directories.length - keep);
      for (let dir of dirsToDelete) {
        // 递归删除目录下的所有文件
        let list = await client.list({
          prefix: dir,
          "max-keys": 1000,
        });
        for (let file of list.objects) {
          await client.delete(file.name);
        }
        console.log(`Deleted old backup: ${dir}`);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up old backups for ${key}: ${error}`);
  }
}

cron.schedule(config.backup.cron, () => {
  console.log("Starting backup task...");
  Promise.all(config.backup.items.map(backupItem)).catch((err) =>
    console.error(`Backup task failed: ${err}`)
  );
});
// Promise.all(config.backup.items.map(backupItem)).catch((err) =>
//   console.error(`Backup task failed: ${err}`)
// );
console.log("Backup service started.");
