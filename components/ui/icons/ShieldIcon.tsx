export const ShieldIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}>
            <path d="M12 3.5 19.5 6v5.5c0 4.2-3 7.4-7.5 9-4.5-1.6-7.5-4.8-7.5-9V6z"/>
        </svg>
    );
};
