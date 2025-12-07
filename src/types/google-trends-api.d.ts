// src/types/google-trends-api.d.ts
declare module 'google-trends-api' {
  interface TrendOptions {
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
  }

  interface DailyTrendsOptions extends TrendOptions {
    trendDate?: Date;
  }

  interface RelatedQueriesOptions extends TrendOptions {
    keyword: string;
    startTime?: Date;
    endTime?: Date;
  }

  interface InterestOverTimeOptions extends TrendOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    granularTimeResolution?: boolean;
  }

  function dailyTrends(options: DailyTrendsOptions): Promise<string>;
  function relatedQueries(options: RelatedQueriesOptions): Promise<string>;
  function interestOverTime(options: InterestOverTimeOptions): Promise<string>;
  function interestByRegion(options: RelatedQueriesOptions): Promise<string>;
  function relatedTopics(options: RelatedQueriesOptions): Promise<string>;

  export {
    dailyTrends,
    relatedQueries,
    interestOverTime,
    interestByRegion,
    relatedTopics,
  };
}
