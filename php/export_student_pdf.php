<?php
include __DIR__ . '/../includes/db_connect.php';

require_once __DIR__ . '/../includes/fpdf/fpdf.php';

$instructor = $_GET['instructor'] ?? '';
$section = $_GET['section'] ?? '';
$maxScore = intval($_GET['max_score'] ?? 40);

if (empty($instructor)) {
    die("instructor parameter required");
}

$members = [];
if (!empty($section)) {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=? AND section=?");
    $stmt->bind_param("ss", $instructor, $section);
} else {
    $stmt = $conn->prepare("SELECT group_name, member1_name, member2_name, member3_name, member4_name, member5_name FROM groups_table WHERE instructor=?");
    $stmt->bind_param("s", $instructor);
}
$stmt->execute();
$groups_result = $stmt->get_result();
$group_members = [];
while ($row = $groups_result->fetch_assoc()) {
    $group_members[$row['group_name']] = $row;
}
$stmt->close();

$all_raters = [];
foreach ($group_members as $gn => $gm) {
    foreach (['member1_name', 'member2_name', 'member3_name', 'member4_name', 'member5_name'] as $col) {
        $name = strtoupper(trim($gm[$col]));
        if (!empty($name) && !isset($all_raters[$name])) {
            $all_raters[$name] = true;
        }
    }
}

$sql = "SELECT rater_name, group_name, total_score FROM group_ratings WHERE instructor=?";
$params = [$instructor];
$types = "s";
if (!empty($section)) {
    $sql .= " AND section=?";
    $params[] = $section;
    $types .= "s";
}

$stmt = $conn->prepare($sql);
if (count($params) === 1) {
    $stmt->bind_param("s", $instructor);
} else {
    $stmt->bind_param("ss", $params[0], $params[1]);
}
$stmt->execute();
$result = $stmt->get_result();

$ratings = [];
while ($row = $result->fetch_assoc()) {
    $name = strtoupper(trim($row['rater_name']));
    if (!isset($ratings[$name])) {
        $ratings[$name] = [];
    }
    $ratings[$name][$row['group_name']] = intval($row['total_score']);
}
$stmt->close();

$all_rater_names = array_keys($all_raters);
foreach ($ratings as $name => $groups) {
    if (!in_array($name, $all_rater_names)) {
        $all_rater_names[] = $name;
    }
}
sort($all_rater_names);

$group_names = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];

// Colors
$cPrimary = [17, 92, 46];
$cPrimaryDark = [10, 30, 20];
$cPrimaryLight = [232, 245, 233];
$cWhite = [255, 255, 255];
$cText = [26, 35, 50];
$cBorder = [180, 190, 180];
$cAccent = [17, 92, 46];
$cGray = [245, 245, 245];

$pdf = new FPDF('L', 'mm', 'Legal');
$pdf->SetMargins(15, 10, 15);
$pdf->AddPage();

// --- Header ---
$logoPath = __DIR__ . '/../assets/images/logo-toggle.png';
$yHeader = 12;
$pdf->SetFont('Arial', 'B', 18);
$pdf->SetTextColor($cPrimaryDark[0], $cPrimaryDark[1], $cPrimaryDark[2]);

if (file_exists($logoPath)) {
    $pdf->Image($logoPath, 18, $yHeader, 0, 12);
    $pdf->SetXY(34, $yHeader + 1);
    $pdf->Cell(0, 12, 'STUDENT RATING RECORDS', 0, 1, 'L');
} else {
    $pdf->SetXY(15, $yHeader);
    $pdf->Cell(0, 12, 'STUDENT RATING RECORDS', 0, 1, 'C');
}

// Horizontal rule
$pdf->SetDrawColor($cPrimary[0], $cPrimary[1], $cPrimary[2]);
$pdf->SetLineWidth(0.5);
$pdf->Line(15, 30, $pdf->GetPageWidth() - 15, 30);
$pdf->SetLineWidth(0.15);

// --- Info Row ---
$pdf->Ln(6);
$pdf->SetFont('Arial', '', 9);
$pdf->SetTextColor($cText[0], $cText[1], $cText[2]);

$infoText = 'Instructor: ' . $instructor;
$infoText .= '  |  Section: ' . ($section ? $section : 'N/A');
$infoText .= '  |  Date: ' . date('F d, Y');
$pdf->Cell(0, 6, $infoText, 0, 1, 'C');
$pdf->Ln(4);

// --- Table Dimensions ---
$numWidth = 9;
$nameWidth = 55;
$colWidth = 18.5;
$usableWidth = $pdf->GetPageWidth() - 30;
$tableWidth = $numWidth + $nameWidth + ($colWidth * 10);
$xStart = 15 + ($usableWidth - $tableWidth) / 2;

$pdf->SetDrawColor(200, 200, 200);
$pdf->SetLineWidth(0.2);

// --- Table Header ---
$pdf->SetFont('Arial', 'B', 7);
$pdf->SetFillColor($cPrimary[0], $cPrimary[1], $cPrimary[2]);
$pdf->SetTextColor($cWhite[0], $cWhite[1], $cWhite[2]);
$pdf->SetX($xStart);
$pdf->Cell($numWidth, 9, '#', 1, 0, 'C', true);
$pdf->Cell($nameWidth, 9, 'NAME OF THE RATER', 1, 0, 'C', true);
for ($i = 1; $i <= 10; $i++) {
    $pdf->Cell($colWidth, 9, 'GROUP ' . $i, 1, 0, 'C', true);
}
$pdf->Ln();

// --- Data Rows ---
$pdf->SetFont('Arial', '', 7.5);
$pdf->SetTextColor($cText[0], $cText[1], $cText[2]);
$counter = 1;
$colTotals = [];
for ($i = 1; $i <= 10; $i++) $colTotals['GROUP ' . $i] = 0;

foreach ($all_rater_names as $name) {
    $fill = ($counter % 2 === 0) ? $cGray : $cWhite;
    $pdf->SetFillColor($fill[0], $fill[1], $fill[2]);
    $pdf->SetX($xStart);
    $pdf->Cell($numWidth, 6.5, $counter, 1, 0, 'C', true);
    $pdf->Cell($nameWidth, 6.5, $name, 1, 0, 'L', true);
    for ($g = 1; $g <= 10; $g++) {
        $gn = 'GROUP ' . $g;
        $score = isset($ratings[$name][$gn]) ? $ratings[$name][$gn] : '';
        if ($score !== '') {
            $colTotals[$gn] += $score;
        }
        $cellText = $score !== '' ? $score . '/40' : '-';
        $pdf->Cell($colWidth, 6.5, $cellText, 1, 0, 'C', true);
    }
    $pdf->Ln();
    $counter++;
}

// --- Total Row ---
$pdf->SetFont('Arial', 'B', 8);
$pdf->SetFillColor($cAccent[0], $cAccent[1], $cAccent[2]);
$pdf->SetTextColor($cWhite[0], $cWhite[1], $cWhite[2]);
$pdf->SetX($xStart);
$pdf->Cell($numWidth, 9, '', 1, 0, 'C', true);
$pdf->Cell($nameWidth, 9, 'TOTAL  |  Max Score: ' . $maxScore, 1, 0, 'C', true);
for ($i = 1; $i <= 10; $i++) {
    $gn = 'GROUP ' . $i;
    $pdf->Cell($colWidth, 9, $colTotals[$gn] . '/' . $maxScore, 1, 0, 'C', true);
}
$pdf->Ln();

// --- Footer ---
$pdf->Ln(10);
$pdf->SetFont('Arial', '', 7);
$pdf->SetTextColor($cText[0], $cText[1], $cText[2]);
$pdf->Cell(0, 4, 'This document was generated automatically by the Rubric System.', 0, 1, 'C');
$pdf->Cell(0, 4, 'Page ' . $pdf->PageNo(), 0, 1, 'C');

$pdf->Output('I', 'Student_Ratings.pdf');
$conn->close();
?>
