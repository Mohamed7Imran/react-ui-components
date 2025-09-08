import { isValidElement, ReactElement, useMemo } from 'react';
import { DateFormatOptions, IL10n, formatUnit, isNullOrUndefined, NumberFormatOptions } from '@syncfusion/react-base';
import { IValueFormatter, CellType, IRow, EditType, ValueType } from '../types';
import { ColumnProps, IColumnBase } from '../types/column.interfaces';
import { AggregateColumnProps } from '../types/aggregate.interfaces';
import { useGridComputedProvider } from '../contexts';
import { setStringFormatter, getObject, getUid, headerValueAccessor as defaultHeaderValueAccessor,
    valueAccessor as defaultValueAccessor, isDateOrNumber } from '../utils';
/**
 * CSS class names used in the Column component
 */
const CSS_CLASS_NAMES: Record<string, string> = {
    LEFT_ALIGN: 'sf-leftalign',
    RIGHT_ALIGN: 'sf-rightalign',
    CENTER_ALIGN: 'sf-centeralign',
    HIDDEN: 'sf-hide'
};
/**
 * Applies default column properties to the provided column configuration
 *
 * @param {IColumnBase} props - The column properties to enhance with defaults
 * @returns {IColumnBase} The column properties with defaults applied
 * @private
 */
export const defaultColumnProps: (props: Partial<IColumnBase>) => Partial<IColumnBase> =
    (props: Partial<IColumnBase>): Partial<IColumnBase> => {
        // computed values should handle in component inside alone since react not allowed us to compute here using memo.
        return {
            visible: true,
            textAlign: 'Left',
            disableHtmlEncode: true,
            allowEdit: true,
            edit: {type: EditType.TextBox},
            filter: { type: 'FilterBar', filterBarType: 'stringFilter' },
            ...props,
            width: props.width ? formatUnit(props.width) : '',
            onValueAccessor: props.onValueAccessor ?? defaultValueAccessor,
            onHeaderValueAccessor: props.onHeaderValueAccessor ?? defaultHeaderValueAccessor,
            type: props.type === 'none' ? null : (props.type ? (typeof (props.type) === 'string' ? props.type.toLowerCase() : undefined) : props.type),
            uid: isNullOrUndefined(props.uid) ? getUid('grid-column') : props.uid,
            getFormatter: props.formatFn,
            getParser: props.parseFn,
            allowSort: props.allowSort ?? true,
            allowFilter: props.allowFilter ?? true,
            allowSearch: props.allowSearch ?? true,
            templateSettings: {
                ariaLabel: '',
                ...props.templateSettings
            }
        };
    };
/**
 * `useColumn` is a custom hook that provides column configuration and formatting logic for grid columns.
 * It handles value formatting, alignment classes, visibility, and template rendering.
 *
 * @private
 * @param {IColumnBase} props - The column configuration properties
 * @returns {Object} Object containing publicAPI (ColumnProps) and privateAPI with cell formatting properties
 */
export const useColumn: (props: Partial<IColumnBase>) => {
    publicAPI: Partial<ColumnProps>;
    privateAPI: {
        cellType: CellType;
        row: IRow<ColumnProps>;
        alignClass: string;
        alignHeaderClass: string;
        visibleClass: string;
        formattedValue: string | Object | ReactElement;
    };
} = (props: Partial<IColumnBase>): {
    publicAPI: Partial<ColumnProps>;
    privateAPI: {
        cellType: CellType;
        row: IRow<ColumnProps>;
        alignClass: string;
        alignHeaderClass: string;
        visibleClass: string;
        formattedValue: string | Object | ReactElement;
    };
} => {
    const {
        cell,
        row
    } = props;
    const {
        column,
        cellType,
        aggregateColumn
    } = cell;
    const {
        customAttributes,
        field,
        width,
        headerText,
        headerTemplate,
        template,
        onValueAccessor,
        onHeaderValueAccessor,
        format,
        type,
        textAlign,
        visible,
        disableHtmlEncode,
        headerTextAlign,
        ...rest
    } = column;
    const { serviceLocator } = useGridComputedProvider();
    const formatter: IValueFormatter = serviceLocator?.getService<IValueFormatter>('valueFormatter');
    const localization: IL10n = serviceLocator?.getService<IL10n>('localization');
    /**
     * Formats a value according to the column's type and format specification
     *
     * @type {(value: string | Object | null) => string}
     */
    const formatValue: (value: string | object | null) => string = useMemo(() => {
        return (value: string | Object | null): string => {
            let updatedType: string = type;
            if (!isNullOrUndefined(format) && formatter) {
                // Handle number validation
                if (type === 'number' && typeof value === 'string' && isNaN(parseInt(value, 10))) {
                    return '';
                }
                // Auto-detect type if not specified
                if (!isNullOrUndefined(value) && !type) {
                    updatedType = value instanceof Date && !isNullOrUndefined(value.getDay) ?
                        ((value.getHours() || value.getMinutes() || value.getSeconds() || value.getMilliseconds()) ? 'datetime' : 'date') :
                        typeof value;
                }
                // Get appropriate formatter function
                const formatterFn: Function = isDateOrNumber(value) ? (typeof format === 'string' ?
                    setStringFormatter(formatter, updatedType, format) :
                    formatter.getFormatFunction?.(format as NumberFormatOptions | DateFormatOptions)) : undefined;

                if (type === 'number' && typeof value === 'string' && isNullOrUndefined(value.split('.')[1])) {
                    value += '.0';
                }
                if (!isNullOrUndefined(formatterFn)) {
                    const viewableContent: string = formatter.toView(value as number | Date, formatterFn) as string;
                    value = viewableContent !== 'NaN' ? viewableContent : value;
                }
            }
            if (type === 'boolean' && !column.displayAsCheckBox) {
                // Handle boolean values properly - check actual boolean value, not just string representation
                // Convert value to string first, then check string representation
                const stringValue: string = value?.toString();
                const localeStr: string = (stringValue !== 'true' && stringValue !== 'false') ? null :
                    stringValue === 'true' ? 'booleanTrueLabel' : 'booleanFalseLabel';

                // If localeStr exists, get localized version, otherwise fall back to original stringValue
                return localeStr ? (localization ? localization.getConstant(localeStr) : stringValue) : stringValue;
            }
            return String(value);
        };
    }, [type, format, formatter]);
    /**
     * Computes the CSS class for header alignment
     *
     * @type {string}
     */
    const alignHeaderClass: string = useMemo(() => {
        const alignment: string = (headerTextAlign ?? textAlign ?? 'Left').toLowerCase();
        return `sf-${alignment}align`;
    }, [headerTextAlign, textAlign]);
    /**
     * Computes the CSS class for cell alignment
     *
     * @type {string}
     */
    const alignClass: string = useMemo(() => {
        const alignment: string = (textAlign ?? 'Left').toLowerCase();
        return `sf-${alignment}align`;
    }, [textAlign]);
    /**
     * Computes visibility class and updates style attributes
     *
     * @type {string}
     */
    const visibleClass: string = useMemo(() => {
        if (CellType.Data === cellType && customAttributes) {
            customAttributes.style = {
                ...customAttributes.style,
                display: visible || isNullOrUndefined(visible) ? '' : 'none'
            };
        }
        return visible || isNullOrUndefined(visible) ? '' : ` ${CSS_CLASS_NAMES.HIDDEN}`;
    }, [visible, cellType, customAttributes]);
    /**
     * Retrieves the raw value from the data row based on field
     *
     * @type {ValueType}
     */
    const value: ValueType = useMemo(() => {
        return (cellType === CellType.Data && field && row && row.isDataRow) ?
            getObject(field, row.data) : undefined;
    }, [cellType, field, row]);
    /**
     * Retrieves the aggregate value from the data based on column information
     *
     * @param {Object} data - The data object containing the column values
     * @param {AggregateColumnProps} column - The column model with aggregation details
     * @returns {Object} - The aggregated value for the specified column, or an empty string if not found
     */
    const getAggregateValue: (data: Object, column: AggregateColumnProps) => Object =
        (data: Object, column: AggregateColumnProps): Object => {
            let key: string = !isNullOrUndefined(column.type) ?
                column.field + ' - ' + (typeof column.type === 'string' ? column.type.toLowerCase() : '') : column.columnName;
            if (column.format && !isNullOrUndefined(column.type) && typeof column.type === 'string') {
                key = column.type;
            }
            return data[column.columnName] ? data[column.columnName][`${key}`] : '';
        };
    /**
     * Computes the formatted value for display, handling templates and type conversions
     *
     * @type {string | ReactElement}
     */
    const formattedValue: string | Object | ReactElement = useMemo(() => {
        let formattedVal: string | Object | ReactElement = value;
        // Handle header cell formatting
        if (cellType === CellType.Header) {
            if (isNullOrUndefined(headerTemplate)) {
                formattedVal = onHeaderValueAccessor({headerText: 'headerText', column});
            } else if (typeof headerTemplate === 'string' || isValidElement(headerTemplate)) {
                return headerTemplate;
            } else {
                return headerTemplate({ column: column, columnIndex: cell.index });
            }
        } else if (cellType === CellType.Filter) {
            return formattedVal;
        } else if (cellType === CellType.Summary) {
            const footerTemplate: string | ReactElement | ((props?: Object) => ReactElement | string) = aggregateColumn.footerTemplate;
            if (isNullOrUndefined(footerTemplate)) {
                return getAggregateValue(row.data, aggregateColumn);
            } else if (typeof footerTemplate === 'string' || isValidElement(footerTemplate)) {
                return footerTemplate;
            } else {
                return footerTemplate(row.data[aggregateColumn.columnName]);
            }
        }
        // Handle data cell formatting
        else {
            if (isNullOrUndefined(template)) {
                formattedVal = onValueAccessor({field: (field as string), rowData: row.data, column: column});
            } else if (typeof template === 'string' || isValidElement(template)) {
                return template;
            } else {
                return template({ column: column, rowData: row.data, rowIndex: row.index });
            }
        }
        // Apply type-specific formatting for values
        if (!isNullOrUndefined(formattedVal)) {
            if ((type === 'date' || type === 'datetime') && !isNullOrUndefined(formattedVal)) {
                const dateValue: Date = new Date(formattedVal as string);
                formattedVal = !isNaN(dateValue?.getTime?.()) ? dateValue : formattedVal;
            }
            if (type === 'dateonly' && typeof formattedVal === 'string') {
                const arr: string[] = formattedVal.split(/[^0-9.]/);
                const dateValue: Date = new Date(parseInt(arr[0], 10), parseInt(arr[1], 10) - 1, parseInt(arr[2], 10));
                formattedVal = !isNaN(dateValue?.getTime?.()) ? dateValue : formattedVal;
            }
            return formatValue(formattedVal);
        } else {
            return formattedVal as string;
        }
    }, [
        value,
        field,
        row,
        cellType,
        template,
        headerTemplate,
        headerText,
        type,
        onValueAccessor,
        onHeaderValueAccessor,
        formatValue
    ]);
    /**
     * Private API for internal component use
     *
     * @type {{ cellType: CellType, row: Object, alignClass: string, alignHeaderClass: string, visibleClass: string, formattedValue: string | ReactElement }}
     */
    const privateAPI: {
        cellType: CellType;
        row: Object;
        alignClass: string;
        alignHeaderClass: string;
        visibleClass: string;
        formattedValue: string | Object | ReactElement;
    } = useMemo(() => ({
        cellType,
        row,
        alignClass,
        alignHeaderClass,
        visibleClass,
        formattedValue
    }), [cellType, row, alignClass, alignHeaderClass, visibleClass, formattedValue]);
    /**
     * Public API exposed to parent components
     *
     * @type {Partial<ColumnProps>}
     */
    const publicAPI: Partial<ColumnProps> = useMemo(() => ({
        field,
        headerText,
        textAlign,
        headerTextAlign,
        format,
        width: formatUnit(width as string | number || ''),
        customAttributes,
        visible,
        disableHtmlEncode,
        ...rest
    }), [field, headerText, textAlign, headerTextAlign, format, width, customAttributes, visible, rest]);
    return { publicAPI, privateAPI };
};
