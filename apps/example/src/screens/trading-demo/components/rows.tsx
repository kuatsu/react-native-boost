import { Fragment, memo } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';

export type StatTone = 'up' | 'down' | 'neutral';

interface HeaderStatProperties {
  label: string;
  value: string;
  tone?: StatTone;
}

interface BookLevel {
  key: string;
  priceText: string;
  sizeText: string;
  totalText: string;
}

interface PriceWallProperties {
  asks: BookLevel[];
  bids: BookLevel[];
  lastPriceText: string;
  lastTone: StatTone;
  spreadText: string;
  baseSymbol: string;
  quoteSymbol: string;
}

const spreadToneStyle = (tone: StatTone) => {
  if (tone === 'up') return styles.spreadLastUp;
  if (tone === 'down') return styles.spreadLastDown;
  return styles.spreadLastNeutral;
};

const directionArrow = (tone: StatTone): string => {
  if (tone === 'up') return '▲ ';
  if (tone === 'down') return '▼ ';
  return '';
};

export const PriceWall = function PriceWall({
  asks,
  bids,
  lastPriceText,
  lastTone,
  spreadText,
  baseSymbol,
  quoteSymbol,
}: PriceWallProperties) {
  return (
    <View style={styles.book}>
      <View style={styles.columnHeader}>
        <Text style={styles.columnLabel} numberOfLines={1}>
          Price ({quoteSymbol})
        </Text>
        <Text style={styles.columnLabelEnd} numberOfLines={1}>
          Amount ({baseSymbol})
        </Text>
        <Text style={styles.columnLabelEnd} numberOfLines={1}>
          Total ({quoteSymbol})
        </Text>
      </View>

      <View style={[styles.grid, styles.gridAsks]}>
        {[...asks].reverse().map((level) => (
          <Fragment key={level.key}>
            {/* @boost-force */}
            <Text style={styles.priceAsk} numberOfLines={1}>
              {level.priceText}
            </Text>
            {/* @boost-force */}
            <Text style={styles.amount} numberOfLines={1}>
              {level.sizeText}
            </Text>
            {/* @boost-force */}
            <Text style={styles.total} numberOfLines={1}>
              {level.totalText}
            </Text>
          </Fragment>
        ))}
      </View>

      <View style={styles.spread}>
        <Text style={spreadToneStyle(lastTone)} numberOfLines={1}>
          {directionArrow(lastTone)}
          {lastPriceText}
        </Text>
        <Text style={styles.spreadLabel} numberOfLines={1}>
          Last price · spread {spreadText}
        </Text>
      </View>

      <View style={[styles.grid, styles.gridBids]}>
        {bids.map((level) => (
          <Fragment key={level.key}>
            {/* @boost-force */}
            <Text style={styles.priceBid} numberOfLines={1}>
              {level.priceText}
            </Text>
            {/* @boost-force */}
            <Text style={styles.amount} numberOfLines={1}>
              {level.sizeText}
            </Text>
            {/* @boost-force */}
            <Text style={styles.total} numberOfLines={1}>
              {level.totalText}
            </Text>
          </Fragment>
        ))}
      </View>
    </View>
  );
};

const toneStyle = (tone: StatTone) => {
  if (tone === 'up') return styles.statUp;
  if (tone === 'down') return styles.statDown;
  return styles.statNeutral;
};

export const HeaderStat = memo(function HeaderStat({ label, value, tone = 'neutral' }: HeaderStatProperties) {
  return (
    <View style={styles.stat}>
      {/* @boost-force */}
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {/* @boost-force */}
      <Text style={toneStyle(tone)} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
});

const tabular = { fontVariant: ['tabular-nums'] } satisfies TextStyle;

// Each ladder shows a fixed whole number of rows; a fixed height that is an exact
// multiple of the row height keeps the overflow clip on a row boundary, so the
// topmost/bottommost visible row is never sliced in half. Extra levels stay mounted
// (and reconciled every frame for the benchmark) but clip off cleanly.
const ROW_HEIGHT = 18;
const VISIBLE_LEVELS = 13;
const LADDER_HEIGHT = ROW_HEIGHT * VISIBLE_LEVELS;

const styles = StyleSheet.create({
  stat: {
    minWidth: 88,
    paddingVertical: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6c7480',
    marginBottom: 2,
  },
  statNeutral: {
    fontSize: 13,
    color: '#eaecef',
    fontWeight: '600',
    ...tabular,
  },
  statUp: {
    fontSize: 13,
    color: '#0ecb81',
    fontWeight: '600',
    ...tabular,
  },
  statDown: {
    fontSize: 13,
    color: '#f6465d',
    fontWeight: '600',
    ...tabular,
  },
  book: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  columnLabel: {
    width: '33.33%',
    fontSize: 10,
    color: '#6c7480',
  },
  columnLabelEnd: {
    width: '33.33%',
    fontSize: 10,
    color: '#6c7480',
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  gridAsks: {
    height: LADDER_HEIGHT,
    alignContent: 'flex-end',
  },
  gridBids: {
    height: LADDER_HEIGHT,
    alignContent: 'flex-start',
  },
  priceAsk: {
    width: '33.33%',
    height: ROW_HEIGHT,
    fontSize: 11,
    color: '#f6465d',
    paddingHorizontal: 3,
    ...tabular,
  },
  priceBid: {
    width: '33.33%',
    height: ROW_HEIGHT,
    fontSize: 11,
    color: '#0ecb81',
    paddingHorizontal: 3,
    ...tabular,
  },
  amount: {
    width: '33.33%',
    height: ROW_HEIGHT,
    fontSize: 11,
    color: '#b7bdc6',
    textAlign: 'right',
    paddingHorizontal: 3,
    ...tabular,
  },
  total: {
    width: '33.33%',
    height: ROW_HEIGHT,
    fontSize: 11,
    color: '#6c7480',
    textAlign: 'right',
    paddingHorizontal: 3,
    ...tabular,
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#222831',
    backgroundColor: '#10151b',
  },
  spreadLastUp: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0ecb81',
    ...tabular,
  },
  spreadLastDown: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f6465d',
    ...tabular,
  },
  spreadLastNeutral: {
    fontSize: 15,
    fontWeight: '700',
    color: '#eaecef',
    ...tabular,
  },
  spreadLabel: {
    fontSize: 10,
    color: '#6c7480',
    ...tabular,
  },
});
