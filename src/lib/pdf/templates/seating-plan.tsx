import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

/* ---------- Types ---------- */

export interface SeatAssignment {
  seatNumber: string;
  studentId: string;
  studentName: string;
}

export interface RoomSeating {
  roomName: string;
  building: string | null;
  seats: SeatAssignment[];
}

export interface SeatingPlanProps {
  schoolName: string;
  subject: string;
  subjectCode: string | null;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: RoomSeating[];
  totalStudents: number;
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 14,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 10,
  },
  schoolName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 90,
  },
  infoValue: {
    flex: 1,
  },
  roomSection: {
    marginBottom: 16,
  },
  roomHeader: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 6,
    borderRadius: 2,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#fff',
  },
  roomCount: {
    fontSize: 9,
    color: '#ccc',
  },
  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  seatCell: {
    width: '25%',
    borderBottom: '0.5px solid #ddd',
    borderRight: '0.5px solid #ddd',
    padding: 4,
    minHeight: 32,
  },
  seatNumber: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#666',
  },
  seatStudentId: {
    fontSize: 7,
    color: '#999',
    marginTop: 1,
  },
  seatStudentName: {
    fontSize: 8,
    marginTop: 1,
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #ccc',
    paddingTop: 8,
  },
  summaryText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
});

/* ---------- Component ---------- */

export const SeatingPlan: React.FC<SeatingPlanProps> = (props) => {
  const { schoolName, subject, subjectCode, className, date, startTime, endTime, rooms, totalStudents } = props;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerSection}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.title}>Examination Seating Plan</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Subject:</Text>
            <Text style={styles.infoValue}>{subject}{subjectCode ? ` (${subjectCode})` : ''}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Class:</Text>
            <Text style={styles.infoValue}>{className}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>{startTime} - {endTime}</Text>
          </View>
        </View>

        {rooms.map((room, rIdx) => (
          <View key={rIdx} style={styles.roomSection}>
            <View style={styles.roomHeader}>
              <Text style={styles.roomName}>
                {room.roomName}{room.building ? ` (${room.building})` : ''}
              </Text>
              <Text style={styles.roomCount}>{room.seats.length} student(s)</Text>
            </View>
            <View style={styles.seatGrid}>
              {room.seats.map((seat, sIdx) => (
                <View key={sIdx} style={styles.seatCell}>
                  <Text style={styles.seatNumber}>Seat {seat.seatNumber}</Text>
                  <Text style={styles.seatStudentId}>{seat.studentId}</Text>
                  <Text style={styles.seatStudentName}>{seat.studentName}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total Rooms: {rooms.length}</Text>
          <Text style={styles.summaryText}>Total Students: {totalStudents}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SeatingPlan;
