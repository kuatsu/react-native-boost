import { Text } from 'react-native';
const a11y = { 'aria-busy': true };
const styleProps = { style: { color: 'red' } };
const disabledProps = { disabled: true };
const nolProps = { numberOfLines: -3 };
<Text {...a11y}>aria</Text>;
<Text {...styleProps}>style</Text>;
<Text {...disabledProps}>disabled</Text>;
<Text {...nolProps}>nol</Text>;
