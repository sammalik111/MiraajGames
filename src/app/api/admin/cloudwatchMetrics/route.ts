// GET /api/admin/cloudwatchMetrics?hours=1
//
// Returns six EC2 metrics for the configured instance over the requested
// window, all fetched in parallel. Admin-only.
//
// The AWS SDK's default provider chain handles both environments:
//   - Local dev: reads AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY from
//                .env.local (your IAM user keys)
//   - Production on EC2: those env vars are absent, so the chain falls
//                through to IMDS and uses the instance role automatically
//
// Required env (both environments):
//   AWS_REGION
//   EC2_INSTANCE_ID
// Local dev only:
//   AWS_ACCESS_KEY_ID
//   AWS_SECRET_ACCESS_KEY

import { NextRequest, NextResponse } from "next/server";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  StandardUnit,
  Statistic,
} from "@aws-sdk/client-cloudwatch";
import { requireAdmin } from "@/lib/requireAdmin";

// ---- Metric catalog ---------------------------------------------------
interface MetricSpec {
  key: string;
  label: string;
  metricName: string;
  namespace: string;
  statistic: Statistic;
  unit: StandardUnit;
}

const METRICS: MetricSpec[] = [
  { key: "cpu",               label: "CPU Utilization",     metricName: "CPUUtilization",     namespace: "AWS/EC2", statistic: Statistic.Average, unit: StandardUnit.Percent },
  { key: "networkIn",         label: "Network In",          metricName: "NetworkIn",          namespace: "AWS/EC2", statistic: Statistic.Sum,     unit: StandardUnit.Bytes   },
  { key: "networkOut",        label: "Network Out",         metricName: "NetworkOut",         namespace: "AWS/EC2", statistic: Statistic.Sum,     unit: StandardUnit.Bytes   },
  { key: "diskReadOps",       label: "Disk Read Ops",       metricName: "DiskReadOps",        namespace: "AWS/EC2", statistic: Statistic.Sum,     unit: StandardUnit.Count   },
  { key: "diskWriteOps",      label: "Disk Write Ops",      metricName: "DiskWriteOps",       namespace: "AWS/EC2", statistic: Statistic.Sum,     unit: StandardUnit.Count   },
  { key: "statusCheckFailed", label: "Status Check Failed", metricName: "StatusCheckFailed",  namespace: "AWS/EC2", statistic: Statistic.Maximum, unit: StandardUnit.Count   },
];

function pickPeriod(hours: number): number {
  if (hours <= 3) return 300;
  if (hours <= 24) return 600;
  return 3600;
}

interface Point { t: number; v: number }

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin();
  if (typeof adminId !== "string") return adminId;

  // region and instance ID are required for a client regardless of local or prod dev, if they're not there fail early 
  const region = process.env.AWS_REGION;
  const instanceId = process.env.EC2_INSTANCE_ID;
  if (!region) {
    return NextResponse.json({ error: "AWS_REGION not set" }, { status: 500 });
  }
  if (!instanceId) {
    return NextResponse.json({ error: "EC2_INSTANCE_ID not set" }, { status: 500 });
  }

  const url = new URL(req.url);
  const hours = Math.max(
    1,
    Math.min(168, parseInt(url.searchParams.get("hours") ?? "1", 10)),
  );
  const period = pickPeriod(hours);
  const endTime = new Date();
  const startTime = new Date(Date.now() - hours * 3600 * 1000);


  try {
    // cloudwatch client handles both prod and dev distinction independently, if IDMS is possible on the instance it will use that route, otherwise my AWS access keys will be used 
    const cw = new CloudWatchClient({ region });
  
    const results = await Promise.all(

      // for each metric, use the preset metric parameters to find the right graph
      METRICS.map(async (m) => {
        const res = await cw.send(
          new GetMetricStatisticsCommand({
            Namespace: m.namespace,
            MetricName: m.metricName,
            Dimensions: [{ Name: "InstanceId", Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: period,
            Statistics: [m.statistic],
            Unit: m.unit,
          }),
        );

        // get all the datapoints for this metric graph, and convert them into [x,y] pairs organize from least to greatest x (time) 
        const points: Point[] = (res.Datapoints ?? [])
          .map((d) => ({
            t: d.Timestamp?.getTime() ?? 0,
            v: (d[m.statistic as keyof typeof d] as number | undefined) ?? 0,
          }))
          .sort((a, b) => a.t - b.t);

        const values = points.map((p) => p.v);
        const summary =
          values.length > 0
            ? {
                latest: values[values.length - 1],
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((a, b) => a + b, 0) / values.length,
              }
            : { latest: null, min: null, max: null, avg: null };
        
        // return the data for the graph of this metric name and map it to the list 
        return {
          key: m.key,
          label: m.label,
          metricName: m.metricName,
          unit: m.unit,
          statistic: m.statistic,
          points,
          ...summary,
        };
      }),
    );

    // return all extrapolated metrics in order for this time period
    return NextResponse.json({
      instanceId,
      region,
      windowHours: hours,
      period,
      generatedAt: new Date().toISOString(),
      metrics: results,
    });
  } catch (error) {
    console.error("CloudWatch fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
