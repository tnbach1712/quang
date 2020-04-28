var express = require('express');
var api = require("./routes/api");
const shell = require('node-powershell');
let ps = new shell({
  executionPolicy: 'Unrestricted',
  noProfile: true,
  debugMsg: false
});
var version = '1.0.0';

var app = express();


app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/ping', function (req, res, next) {
  res.send(JSON.stringify({ result: 'ok' }));
});

app.get('/server/info', function (req, res, next) {
  try {
    var fs = require('fs');
    var process = require('child_process');

    var cmd = 'wmic logicaldisk get size,freespace,caption /format:list';
    process.exec(cmd, (err, stdout, stderr) => {
      if (err) {
        res.send(JSON.stringify({ result: 'failed', message: err.toString() }));
        return;
      }
      data = stdout.toString("ascii");
      var lines = data.split("\r\r\n\r\r\n");
      var hdd = new Array();
      var ram = new Array();
      var cpu = new Array();
      var ram_t = new Array();

      for (var i = 0; i < lines.length; i++) {
        if (lines[i][0] != "") {
          var line = lines[i].split("\r\r\n");
          var brr = [];

          for (var a = 0; a < line.length; a++) {
            if (line[a] != "") {
              var pro = line[a].split("=");
              brr.push(line[a]);
            }

          }
          hdd.push(brr);
        }
      }


      //get total ram
      var cmd2 = "wmic OS get FreePhysicalMemory /format:list";
      process.exec(cmd2, (err, stdout, stderr) => {
        data2 = stdout.toString("ascii");
        var test = new Array();

        var lines2 = data2.split("\r\r\n\r\r\n");

        var ram_free = "";
        for (var a = 0; a < lines2.length; a++) {

          if (lines2[a] != "") {

            ram_free = lines2[a];
          }
        }

        ram.push(ram_free)

      });

      //get ram
      var cmd4 = "wmic computersystem get TotalPhysicalMemory /format:list";
      process.exec(cmd4, (err, stdout, stderr) => {
        data4 = stdout.toString("ascii");
        var lines4 = data4.split("\r\r\n\r\r\n");
        var ram_total = "";
        for (var a = 0; a < lines4.length; a++) {
          if (lines4[a] != "") {
            ram_total = lines4[a];
          }
        }
        ram_t.push(ram_total);

      });

      // get cpu usage by wmic
      var cmd3 = "wmic cpu get loadpercentage /format:list";
      //get cpu usage by typeperf
      var cmd_typeperf = 'typeperf \"\\Processor(_Total)\\% Processor Time\" -si 10 -sc 1';
      process.exec(cmd3, (err, stdout, stderr) => {
        data3 = stdout.toString("ascii");
        var lines3 = data3.split("\r\r\n\r\r\n");
        var cpu_usage = "";
        for (var a = 0; a < lines3.length; a++) {
          if (lines3[a] != "") {
            cpu_usage = lines3[a];
          }
        }

        if (cpu_usage.split("=")[1] == "") {
          // get by wmic is nil switch to get by typeperf
          process.exec(cmd_typeperf, (err, stdout, stderr) => {
            cpu_usage = stdout.split(",")[2];
            res.send(JSON.stringify({ result: 'ok', host: hdd, ram_free_total: ram, cpu_usage: cpu_usage, ram_total: ram_t, type: 'typeperf' }));
          });
        } else {
          cpu.push(cpu_usage);
          res.send(JSON.stringify({ result: 'ok', host: hdd, ram_free_total: ram, cpu_usage: cpu, ram_total: ram_t }));
        }
      });

    });
  } catch (ex) {
    res.send(JSON.stringify({ result: "failed", message: ex.toString() }));
  }
});

app.get("/server/info2", function (req, res, next) {
  try {
    data = pollData = processData = systems = cpu = diskRaw = diskPerf = networks = networkData = wamp = proccesses = diskArray = memory = response = null;
    ps.addCommand(
      '$systemName = Get-CimInstance -Query "SELECT Name FROM Win32_ComputerSystem"'
    );
    ps.addCommand(
      '$systemData = Get-CimInstance -Query "SELECT Caption,OsArchitecture,TotalVisibleMemorySize,FreePhysicalMemory FROM Win32_OperatingSystem"'
    );
    ps.addCommand(
      '$systemPerf = Get-CimInstance -Query "SELECT SystemUpTime,ProcessorQueueLength FROM Win32_PerfFormattedData_PerfOS_System" -OperationTimeoutSec 2 -ErrorAction SilentlyContinue'
    );
    ps.addCommand(
      "if(!$systemPerf) { $uptime = 0 } else { $uptime = $systemPerf.SystemUpTime }"
    );
    ps.addCommand(
      '$ipAdr = Get-CimInstance -Query "SELECT IPAddress FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=true"'
    );
    ps.addCommand(
      '[array]$cpu = Get-CimInstance -Query "SELECT Name,NumberOfCores FROM Win32_Processor"'
    );
    ps.addCommand(
      "[array]$cpuProcTime = Get-CimInstance -Query \"select PercentProcessorTime from Win32_PerfFormattedData_PerfOS_Processor where NOT name = '_Total'\" -OperationTimeoutSec 2 -ErrorAction SilentlyContinue"
    );
    ps.addCommand("$cpuData = @()");
    ps.addCommand(
      "if ($cpuProcTime) { foreach ($i in $cpuProcTime) {$cpuData += $i.PercentProcessorTime}; $cpuData = @{cpuLoad=($cpuData | Measure-Object -Average).Average;procQueue=$systemPerf.ProcessorQueueLength}; }"
    );
    ps.addCommand(
      '[array]$disksPerfRaw = Get-CimInstance -Query "SELECT Name,DiskReadBytesPerSec,DiskWriteBytesPerSec,CurrentDiskQueueLength FROM Win32_PerfFormattedData_PerfDisk_PhysicalDisk" -OperationTimeoutSec 2 -ErrorAction SilentlyContinue'
    );
    ps.addCommand(
      "if ($disksPerfRaw) { [array]$diskPerfArray = foreach($disk in $disksPerfRaw) {[PSCustomObject]@{name=$disk.Name;diskReadBytesPerSec=$disk.diskReadBytesPerSec;diskWriteBytesPerSec=$disk.DiskWriteBytesPerSec;currentDiskQueueLength=$disk.CurrentDiskQueueLength}} } else { $diskPerfArray = @() }"
    );
    ps.addCommand(
      '[array]$disksRaw = Get-CimInstance -Query "SELECT Name,Size,FreeSpace FROM Win32_LogicalDisk"'
    );
    ps.addCommand(
      "[array]$diskRawArray = foreach($disk in $disksRaw) {[PSCustomObject]@{name=$disk.Name;size=$disk.Size;freeSpace=$disk.FreeSpace}}"
    );
    ps.addCommand(
      '[array]$networks = Get-CimInstance -Query "SELECT Name,PacketsReceivedPerSec,PacketsSentPerSec,BytesReceivedPerSec,BytesSentPerSec FROM Win32_PerfFormattedData_Tcpip_NetworkInterface" -OperationTimeoutSec 2 -ErrorAction SilentlyContinue'
    );
    ps.addCommand(
      "if ($networks) { [array]$networkArray = foreach($network in $networks){[PSCustomObject]@{name=$network.Name;packetsReceivedPerSec=$network.PacketsReceivedPerSec;packetsSentPerSec=$network.PacketsSentPerSec;bytesReceivedPerSec=$network.BytesReceivedPerSec;bytesSentPerSec=$network.BytesSentPerSec}} } else { $networkArray = @() }"
    );
    ps.addCommand(
      "$systems = @{os=$systemData.Caption;name=$systemName.Name;ip=$ipAdr.IPAddress;architecture=$systemData.OsArchitecture;proccessor=$cpu[0].Name;cores=$cpu[0].NumberOfCores;uptime=$uptime;totalMemory=$systemData.TotalVisibleMemorySize;freeMemory=$systemData.FreePhysicalMemory}"
    );
    ps.addCommand(
      "[array]$diskPerfArray = foreach($disk in $disksPerfRaw) {[PSCustomObject]@{name=$disk.Name;diskReadBytesPerSec=$disk.diskReadBytesPerSec;diskWriteBytesPerSec=$disk.DiskWriteBytesPerSec;currentDiskQueueLength=$disk.CurrentDiskQueueLength}}"
    );
    ps.addCommand(
      "[array]$networkArray = foreach($network in $networks){[PSCustomObject]@{name=$network.Name;packetsReceivedPerSec=$network.PacketsReceivedPerSec;packetsSentPerSec=$network.PacketsSentPerSec;bytesReceivedPerSec=$network.BytesReceivedPerSec;bytesSentPerSec=$network.BytesSentPerSec}}"
    );
    ps.addCommand("$ProcArray = @()");
    ps.addCommand(
      "$Processes = get-process| where {$_.Path -like 'C:\\sspanel\\gameservers*'}"
    );
    ps.addCommand(
      "foreach($Process in $Processes){$prop = @(@{n='Name';e={$Process.Name}};@{n='Path';e={$Process.Path}};@{n='Memory';e={($Process.WorkingSet64/1MB)}});$ProcArray += \"\" | select $prop}"
    );
    ps.addCommand(
      "$procData = $ProcArray | sort -Descending Memory | select Name,Path,@{n='Memory';e={\"$([math]::Round($_.Memory))\"}}"
    );
    ps.addCommand(
      "$wamp = Get-CimInstance -Query \"SELECT Name FROM Win32_Process WHERE Name='httpd.exe'\""
    );
    ps.addCommand("$wampProcess = if($wamp){ 1 } else { 0 }");
    ps.addCommand(
      "$data = [PSCustomObject]@{system=$systems;cpu=$cpuData;diskRaw=$diskRawArray;diskPerf=$diskPerfArray;wamp=$wampProcess;network=$networkArray;processes=$procData}"
    );
    ps.addCommand("$data | ConvertTo-Json -Compress");
    ps.invoke().then(output => {
      data = JSON.parse(output);
      return data;
    }).catch(err => {
      console.log(err);
      res.send(JSON.stringify({
        result: err,
        version: version
      }));
      return;
    }).then(data => {
      // Assign all vars
      systems = data.system;
      cpu = data.cpu;
      diskRaw = data.diskRaw;
      diskPerf = data.diskPerf;
      networks = data.network;
      wamp = data.wamp;
      proccesses = data.processes;

      diskParse(diskPerf);
      memoryParse(systems);
      networkParse(networks);
    }).catch(err => {
      console.log(err);
      res.send(JSON.stringify({
        result: err,
        version: version
      }));
      return;
    }).then(unparsed => {
      if (cpu == []) {
        var cpuLoad = 0;
        var procQueue = 0;
      } else {
        var cpuLoad = cpu.cpuLoad;
        var procQueue = cpu.procQueue;
      }
      var parsedData = {
        system: {
          name: systems.name,
          os: systems.os,
          ip: systems.ip,
          architecture: systems.architecture,
          proccessor: systems.proccessor,
          cores: systems.cores,
          uptime: systems.uptime
        },
        cpu: {
          cpuload: cpuLoad,
          procqueue: procQueue,
        },
        disks: diskArray,
        memory: memory,
        network: networkData,
        wamp: wamp,
        proccesses: proccesses
      };
      return parsedData;
    }).catch(err => {
      console.log(err);
      res.send(JSON.stringify({
        error: err,
        version: version
      }));
    }).then(parsedData => {
      response = parsedData;
      res.json({
        message: 'ok',
        data: response,
        version: version
      });
    });
  } catch (ex) {
    res.send(JSON.stringify({ result: "failed", message: ex.toString() }));
  }
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});



function restartApp() {
  intervalPid = setInterval(function () {
    console.log(global.status.indexOf("processing"));
    var checkTaskFinish = global.checkTask === undefined || global.checkTask.length == 0;

    if (!checkTaskFinish) {
      // kiem tra xem, neu như 1 thoi gian task gân nhất update, Nếu như là 1tiếng trước thì xem dư đã hoàn thành
      var minMaxTime = minmax(global.checkTask, 'time');
      var lastTime = minMaxTime.max * 1000;
      var currentTime = new Date().getTime();
      checkTaskFinish = currentTime - lastTime > 3600000 ? true : false;
    }

    if (global.status.indexOf("processing") == -1 && checkTaskFinish) {
      var exec = require("child_process");
      exec.execSync("copy restart.txt /B+ ,,/Y");
      clearInterval(intervalPid);
    } else {
    }
  }, 30000)
}

const minmax = function (someArrayOfObjects, someKey) {
  const values = someArrayOfObjects.map(value => value[someKey]);
  return {
    min: Math.min.apply(null, values),
    max: Math.max.apply(null, values)
  };
};


function diskParse(diskPerf) {
  diskArray = new Array();
  for (var n = 0; n < diskRaw.length; n++) {
    var disk = diskRaw[n];
    var totalSpace = (disk.size / 1024 / 1024 / 1024).toFixed(2);
    var freeSpace = (disk.freeSpace / 1024 / 1024 / 1024).toFixed(2);
    var usedSpace = (totalSpace - freeSpace).toFixed(2);
    var freeSpacePercent = ((disk.freeSpace / disk.size) * 100).toFixed(2);
    if (freeSpacePercent == 'NaN') {
      freeSpacePercent = 0;
    }

    if (diskPerf != {}) {
      var diskJson = {
        name: disk.name,
        totalSpace: totalSpace,
        usedSpace: usedSpace,
        freeSpacePercent: freeSpacePercent
      }
    } else {
      var thisDiskPerf = diskPerf.filter(function (x) { return x.name.replace(/\d\s/i, "") == disk.name })[0];
      var diskJson = {
        name: disk.name,
        totalSpace: totalSpace,
        usedSpace: usedSpace,
        freeSpacePercent: freeSpacePercent,
        readActivity: thisDiskPerf.diskReadBytesPerSec,
        writeActivity: thisDiskPerf.diskWriteBytesPerSec,
        diskQueue: thisDiskPerf.currentDiskQueueLength
      }
    }
    var diskPerfTotal = diskPerf.filter(function (x) { return x.name == '_Total' })[0]
    var diskTotal = {
      name: 'total',
      totalSpace: diskArray.reduce((a, b) => +a + +b.totalSpace, 0),
      usedSpace: diskArray.reduce((a, b) => +a + +b.usedSpace, 0),
      freeSpacePercent: ((1 - (diskArray.reduce((a, b) => +a + +b.usedSpace, 0)) / (diskArray.reduce((a, b) => +a + +b.totalSpace, 0))) * 100).toFixed(2),
      readActivity: (diskPerfTotal.diskReadBytesPerSec / 1024 / 1024).toFixed(2),
      writeActivity: (diskPerfTotal.diskWriteBytesPerSec / 1024 / 1024).toFixed(2),
      diskQueue: diskPerfTotal.currentDiskQueueLength,
    }
    diskArray.push(diskTotal);

    diskArray.push(diskJson);
  }

  var diskPerfTotal = diskPerf.filter(function (x) { return x.name == '_Total' })[0]
  var total = {
    name: 'total',
    totalSpace: diskArray.reduce((a, b) => +a + +b.totalSpace, 0),
    usedSpace: diskArray.reduce((a, b) => +a + +b.usedSpace, 0),
    freeSpacePercent: ((1 - (diskArray.reduce((a, b) => +a + +b.usedSpace, 0)) / (diskArray.reduce((a, b) => +a + +b.totalSpace, 0))) * 100).toFixed(2),
    readActivity: (diskPerfTotal.diskReadBytesPerSec / 1024 / 1024).toFixed(2),
    writeActivity: (diskPerfTotal.diskWriteBytesPerSec / 1024 / 1024).toFixed(2),
    diskQueue: diskPerfTotal.currentDiskQueueLength,
  }
  console.log(total)
  diskArray.push(total);
  return diskArray;
};

// get memory data
function memoryParse(systems) {
  var totalMemory = (systems.totalMemory / 1024 / 1024).toFixed(2);
  var freeMemory = (systems.freeMemory / 1024 / 1024).toFixed(2);
  var usedMemory = (totalMemory - freeMemory).toFixed(2);
  memory = {
    totalMemory: totalMemory,
    freeMemory: freeMemory,
    usedMemory: usedMemory
  };
  return memory;
};

// get network data
function networkParse(networks) {
  if (networks == {}) {
  } else {
    var packetsRecieved = 0;
    var packetsSent = 0;
    var bytesReceived = 0;
    var bytesSent = 0;
    for (var n = 0; n < networks.length; n++) {
      var network = networks[n];
      packetsRecieved += network.packetsReceivedPerSec;
      packetsSent += network.packetsSentPerSec;
      bytesReceived += network.bytesReceivedPerSec;
      bytesSent += network.bytesReceivedPerSec;
    };
    networkData = {
      packetsReceivedPerSec: packetsRecieved,
      packetsSentPerSec: packetsSent,
      bytesReceivedPerSec: bytesReceived,
      bytesSentPerSec: bytesSent
    };
  }
  return networkData;
};

function sendResponse(res) {
  res.json({
    message: 'ok',
    data: response,
    version: version
  });
};
